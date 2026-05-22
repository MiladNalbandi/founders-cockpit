"""Celery tasks for agent execution."""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings

log = logging.getLogger(__name__)


def _select_runtime():
    """Lazy-import so the SDK is only loaded when the backend is set to it."""
    if settings.AGENT_BACKEND == "claude_sdk":
        from . import runtime_sdk

        return runtime_sdk
    from . import runtime

    return runtime


@shared_task(name="agents.run_agent")
def run_agent_task(agent_id: int, user_input: str) -> dict:
    return _select_runtime().run_agent(agent_id, user_input)


@shared_task(name="pipelines.run_step")
def run_pipeline_step_task(step_id: int, user_input: str) -> dict:
    """Run the agent for a pipeline step, then report back to the orchestrator."""
    from apps.agents.models import Agent
    from apps.pipelines import orchestrator
    from apps.pipelines.models import PipelineStep

    try:
        step = PipelineStep.objects.select_related("run__pipeline__project").get(pk=step_id)
    except PipelineStep.DoesNotExist:
        return {"ok": False, "error": f"step {step_id} not found"}

    agent = Agent.objects.get(project_id=step.run.pipeline.project_id, role=step.role)
    result = _select_runtime().run_agent(agent.id, user_input)

    if result.get("ok"):
        artifact_path = _pick_artifact_path_for_agent(agent)
        # V3.2: Eng Lead no longer spawns tickets — sub-engineers are pipeline steps.
        orchestrator.complete_step(step.id, result.get("run_id") or 0, artifact_path)
    else:
        orchestrator.fail_step(step.id, result.get("error", "agent run failed"))
    return result


@shared_task(name="tickets.run_ticket")
def run_ticket_task(ticket_id: int) -> dict:
    """Run the assigned agent against a single ticket and report back."""
    from apps.agents.models import Agent
    from apps.tickets import orchestrator as ticket_orch
    from apps.tickets.models import Ticket

    try:
        ticket = Ticket.objects.select_related("project").get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return {"ok": False, "error": f"ticket {ticket_id} not found"}

    if not ticket.assignee_role:
        ticket_orch.fail_in_progress(ticket.id, "no assignee")
        return {"ok": False, "error": "no assignee"}
    try:
        agent = Agent.objects.get(project=ticket.project, role=ticket.assignee_role)
    except Agent.DoesNotExist:
        ticket_orch.fail_in_progress(ticket.id, f"no agent for role {ticket.assignee_role}")
        return {"ok": False, "error": f"no agent for role {ticket.assignee_role}"}

    input_text = _ticket_input_text(ticket)
    result = _select_runtime().run_agent(agent.id, input_text)
    if result.get("ok"):
        artifact_path = _pick_artifact_path_for_agent(agent)
        ticket_orch.complete_in_progress(ticket.id, result.get("run_id") or 0, artifact_path)
    else:
        ticket_orch.fail_in_progress(ticket.id, result.get("error", "agent run failed"))
    return result


def _ticket_input_text(ticket) -> str:
    base = (
        f"=== TICKET #{ticket.id} ({ticket.priority}) ===\n"
        f"Title: {ticket.title}\n\n"
        f"Description:\n{ticket.description}\n"
    )
    if ticket.feedback:
        base += (
            f"\n--- PRIOR REVISION FEEDBACK (revision {ticket.revision}) ---\n"
            f"{ticket.feedback}\n"
            f"Address this feedback in your work; do not repeat the same mistake.\n"
        )
    return base


def _pick_artifact_path_for_agent(agent) -> str:
    """Find the most recently written artifact for this agent."""
    from apps.artifacts.models import Artifact

    art = (
        Artifact.objects.filter(project_id=agent.project_id, agent_id=agent.id)
        .order_by("-updated_at")
        .first()
    )
    return art.path if art else ""


# V3.2: _spawn_engineering_tickets removed — sub-engineers are pipeline steps now.
