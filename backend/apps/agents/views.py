from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.projects.models import Project

from .bootstrap import bootstrap_agents_for_project
from .models import Agent, AgentEvent
from .registry import role_spec
from .serializers import AgentEventSerializer, AgentSerializer
from .tasks import run_agent_task


def _project_for(user, project_id: int) -> Project:
    return get_object_or_404(Project, pk=project_id, owner=user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_agents(request, project_id: int):
    project = _project_for(request.user, project_id)
    # Lazy-bootstrap if a project pre-dates the signal (e.g. fixtures).
    if not project.agents.exists():
        bootstrap_agents_for_project(project)
    qs = project.agents.all().order_by("id")
    return Response(AgentSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_agent_endpoint(request, project_id: int, role: str):
    project = _project_for(request.user, project_id)
    try:
        role_spec(role)
    except KeyError:
        return Response({"detail": "unknown role"}, status=400)
    agent = get_object_or_404(Agent, project=project, role=role)
    user_input = request.data.get("input") or project.idea or "Begin your work for this project."
    # Run via Celery (eager mode runs inline; great for first-launch smoke).
    async_result = run_agent_task.delay(agent.id, user_input)
    return Response(
        {"agent_id": agent.id, "role": agent.role, "task_id": str(async_result.id)},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_events(request, project_id: int):
    project = _project_for(request.user, project_id)
    limit = int(request.query_params.get("limit", "200"))
    qs = (
        AgentEvent.objects.filter(agent__project=project)
        .select_related("agent")
        .order_by("-created_at")[:limit]
    )
    # Return oldest-first for the UI feed.
    data = AgentEventSerializer(reversed(list(qs)), many=True).data
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def agent_dashboard(request, project_id: int, role: str):
    """Per-agent dashboard: current work, queue, history, recent events."""
    from apps.pipelines.models import PipelineStep, PipelineStepStatus
    from apps.tickets.models import Ticket, TicketStatus
    from apps.tickets.serializers import TicketSerializer

    project = _project_for(request.user, project_id)
    try:
        role_spec(role)
    except KeyError:
        return Response({"detail": "unknown role"}, status=400)
    agent = get_object_or_404(Agent, project=project, role=role)

    tickets_qs = Ticket.objects.filter(project=project, assignee_role=role)
    active_ticket = (
        tickets_qs.filter(status__in=[TicketStatus.IN_PROGRESS, TicketStatus.TRIAGED])
        .order_by("-updated_at")
        .first()
    )
    queue = list(
        tickets_qs.filter(status__in=[TicketStatus.TRIAGED, TicketStatus.CREATED])
        .order_by("-created_at")[:10]
    )
    if active_ticket and active_ticket in queue:
        queue.remove(active_ticket)
    completed = list(
        tickets_qs.filter(
            status__in=[TicketStatus.DONE, TicketStatus.IN_REVIEW]
        ).order_by("-updated_at")[:10]
    )

    active_step = (
        PipelineStep.objects.filter(
            run__pipeline__project=project,
            role=role,
            status__in=[
                PipelineStepStatus.RUNNING,
                PipelineStepStatus.AWAITING,
                PipelineStepStatus.READY,
            ],
        )
        .order_by("-started_at")
        .first()
    )
    recent_steps = PipelineStep.objects.filter(
        run__pipeline__project=project, role=role
    ).order_by("-finished_at")[:5]

    recent_events = AgentEvent.objects.filter(agent=agent).order_by("-created_at")[:20]

    return Response(
        {
            "agent": AgentSerializer(agent).data,
            "active_ticket": TicketSerializer(active_ticket).data if active_ticket else None,
            "active_step": (
                {
                    "id": active_step.id,
                    "run_id": active_step.run_id,
                    "status": active_step.status,
                    "artifact_path": active_step.artifact_path,
                    "started_at": active_step.started_at.isoformat() if active_step.started_at else None,
                }
                if active_step
                else None
            ),
            "queue": TicketSerializer(queue, many=True).data,
            "completed": TicketSerializer(completed, many=True).data,
            "recent_steps": [
                {
                    "id": s.id,
                    "run_id": s.run_id,
                    "status": s.status,
                    "artifact_path": s.artifact_path,
                    "finished_at": s.finished_at.isoformat() if s.finished_at else None,
                }
                for s in recent_steps
            ],
            "recent_events": AgentEventSerializer(
                reversed(list(recent_events)), many=True
            ).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def team_dashboard(request, project_id: int):
    """Per-team summary: each department with agents + ticket counts + active steps."""
    from apps.pipelines.models import PipelineStep, PipelineStepStatus
    from apps.tickets.models import Ticket

    from .registry import REGISTRY, ordered_roles

    project = _project_for(request.user, project_id)
    if not project.agents.exists():
        bootstrap_agents_for_project(project)

    teams: dict[str, dict] = {}
    for spec in ordered_roles():
        dept = spec.department
        teams.setdefault(
            dept,
            {
                "department": dept,
                "agents": [],
                "tickets_by_status": {
                    "created": 0,
                    "triaged": 0,
                    "in_progress": 0,
                    "in_review": 0,
                    "done": 0,
                    "rejected": 0,
                },
                "active_step_count": 0,
            },
        )
        agent = project.agents.filter(role=spec.role).first()
        if agent:
            teams[dept]["agents"].append(AgentSerializer(agent).data)

    for t in Ticket.objects.filter(project=project):
        spec = REGISTRY.get(t.assignee_role)
        if not spec:
            continue
        dept = spec.department
        if dept in teams and t.status in teams[dept]["tickets_by_status"]:
            teams[dept]["tickets_by_status"][t.status] += 1

    active_steps = PipelineStep.objects.filter(
        run__pipeline__project=project,
        status__in=[
            PipelineStepStatus.RUNNING,
            PipelineStepStatus.AWAITING,
            PipelineStepStatus.READY,
        ],
    )
    for s in active_steps:
        spec = REGISTRY.get(s.role)
        if not spec:
            continue
        dept = spec.department
        if dept in teams:
            teams[dept]["active_step_count"] += 1

    return Response(list(teams.values()))
