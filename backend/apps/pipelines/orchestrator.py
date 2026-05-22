"""Pipeline orchestrator — drives the agent chain with human approval gates.

State machine (per step):

    pending  ──(deps satisfied)──>  ready
       │                              │
       │                              ▼
       │                          running
       │                              │
       │              ┌───────────────┴───────────────┐
       │              │ (after_run mode)              │ (skip mode / non-milestone)
       │              ▼                               ▼
       │       awaiting_approval                    done
       │              │
       │      ┌───────┴───────┬───────────┐
       │      ▼               ▼           ▼
       │   approved        rejected      done (edit ⇒ artifact replaced)
       │      │               │
       │      ▼               ▼
       │   advance        new step (revision+1) in 'ready'
       ▼
    skipped (only when an ancestor was rejected and we abandon)

The orchestrator never holds long synchronous work; it only:
  - reads pipeline state
  - dispatches Celery tasks
  - persists status transitions
  - broadcasts to the WS layer.
"""
from __future__ import annotations

import logging
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from apps.agents.broadcast import push
from apps.agents.models import Agent

from .models import (
    MILESTONE_ROLES,
    ApprovalMode,
    Pipeline,
    PipelineRun,
    PipelineRunStatus,
    PipelineStep,
    PipelineStepStatus,
)

log = logging.getLogger(__name__)


# Default pipeline template used when no CEO-generated plan is available.
DEFAULT_IDEA_TO_MVP: dict = {
    "name": "idea-to-mvp",
    "description": "Idea → PRD → Design → Parallel Eng Team → MVP → Release",
    # Hierarchy: Engineering's sub-agents (Frontend ∥ Backend, then QA) are
    # first-class pipeline steps so they run in true parallel.
    "steps": [
        {"role": "product", "depends_on": []},
        {"role": "designer", "depends_on": ["product"]},
        {"role": "engineer", "depends_on": ["designer"]},  # Eng Lead = planning
        # Engineering team — Frontend and Backend run truly in parallel after Eng Lead.
        {"role": "frontend_eng", "depends_on": ["engineer"]},
        {"role": "backend_eng", "depends_on": ["engineer"]},
        # QA Eng waits for both. After QA, post-eng roles run in parallel.
        {"role": "qa_eng", "depends_on": ["frontend_eng", "backend_eng"]},
        {"role": "marketer", "depends_on": ["qa_eng"]},
        {"role": "engagement", "depends_on": ["qa_eng"]},
        {"role": "analyst", "depends_on": ["qa_eng"]},
        {"role": "release", "depends_on": ["qa_eng"]},
    ],
}


# ---------------------------------------------------------------------------
# Pipeline lifecycle
# ---------------------------------------------------------------------------


class PipelineConflict(Exception):
    """Raised by start_pipeline when a run is already in-flight and cancel_running=False."""

    def __init__(self, active_run_id: int):
        self.active_run_id = active_run_id
        super().__init__(f"Pipeline run {active_run_id} is still active")


ACTIVE_RUN_STATUSES = (
    PipelineRunStatus.PENDING,
    PipelineRunStatus.RUNNING,
    PipelineRunStatus.AWAITING,
)


def _active_run_for(project) -> PipelineRun | None:
    return (
        PipelineRun.objects.filter(
            pipeline__project=project, status__in=ACTIVE_RUN_STATUSES
        )
        .order_by("-started_at")
        .first()
    )


@transaction.atomic
def start_pipeline(
    project,
    initiator,
    template: dict | None = None,
    approval_mode: str | None = None,
    description: str = "",
    cancel_running: bool = False,
) -> PipelineRun:
    """Create a Pipeline + PipelineRun from the template and dispatch the first step(s).

    If another run is currently active (pending / running / awaiting_approval) and
    ``cancel_running`` is False, raise :class:`PipelineConflict`. When True, cancel
    that prior run first, then start the new one.
    """
    active = _active_run_for(project)
    if active:
        if not cancel_running:
            raise PipelineConflict(active.id)
        cancel_run(active.id)

    template = template or DEFAULT_IDEA_TO_MVP
    pipeline, _ = Pipeline.objects.update_or_create(
        project=project,
        name=template["name"],
        defaults={
            "description": template.get("description", ""),
            "template_data": template,
        },
    )
    mode = approval_mode or getattr(initiator, "default_approval_mode", ApprovalMode.AFTER_RUN)
    run = PipelineRun.objects.create(
        pipeline=pipeline,
        initiator=initiator,
        approval_mode=mode,
        description=description or "",
        status=PipelineRunStatus.RUNNING,
    )

    # Create steps preserving order, then wire dependencies.
    steps_by_role: dict[str, PipelineStep] = {}
    for step_def in template["steps"]:
        step = PipelineStep.objects.create(run=run, role=step_def["role"])
        steps_by_role[step_def["role"]] = step
    for step_def in template["steps"]:
        deps = step_def.get("depends_on") or []
        if deps:
            steps_by_role[step_def["role"]].depends_on.set(
                [steps_by_role[r] for r in deps if r in steps_by_role]
            )

    # Mark root steps READY; dispatch each.
    for step in steps_by_role.values():
        if step.depends_on.count() == 0:
            step.status = PipelineStepStatus.READY
            step.save(update_fields=["status"])
    _broadcast_run(run)
    for step in steps_by_role.values():
        if step.status == PipelineStepStatus.READY:
            _dispatch(step)
    return run


# ---------------------------------------------------------------------------
# Agent completion (called from runtime)
# ---------------------------------------------------------------------------


def complete_step(step_id: int, agent_run_id: int, artifact_path: str | None) -> None:
    """Called by the agent runtime when an agent finishes successfully."""
    with transaction.atomic():
        # select_for_update(of=("self",)) locks only the PipelineStep row.
        # Using plain select_for_update() + select_related("run__initiator") causes
        # "FOR UPDATE cannot be applied to the nullable side of an outer join" in Postgres
        # because initiator is a nullable FK.
        step = (
            PipelineStep.objects.select_for_update(of=("self",))
            .select_related("run__pipeline__project", "run__initiator")
            .get(pk=step_id)
        )
        # Guard: if the run was cancelled or already done while the agent was running,
        # silently discard this completion so we don't resurrect a dead run.
        if step.run.status in (PipelineRunStatus.CANCELLED, PipelineRunStatus.DONE):
            log.info("complete_step: run %s is %s — discarding late completion of step %s",
                     step.run_id, step.run.status, step_id)
            step.status = PipelineStepStatus.SKIPPED
            step.finished_at = timezone.now()
            step.save(update_fields=["status", "finished_at"])
            return

        if agent_run_id:
            step.agent_run_id = agent_run_id
        step.finished_at = timezone.now()
        if artifact_path:
            step.artifact_path = artifact_path

        if _needs_approval(step.run, step.role):
            step.status = PipelineStepStatus.AWAITING
        else:
            step.status = PipelineStepStatus.DONE
        step.save()

    _broadcast_step(step)
    if step.status == PipelineStepStatus.DONE:
        _advance(step)
    elif step.status == PipelineStepStatus.AWAITING:
        _set_run_status(step.run_id, PipelineRunStatus.AWAITING)


def fail_step(step_id: int, error: str) -> None:
    """Called by the runtime when an agent errors (including timeout)."""
    with transaction.atomic():
        step = PipelineStep.objects.select_for_update(of=("self",)).select_related("run").get(pk=step_id)
        # Don't change anything on an already-cancelled run.
        if step.run.status in (PipelineRunStatus.CANCELLED, PipelineRunStatus.DONE):
            step.status = PipelineStepStatus.SKIPPED
            step.finished_at = timezone.now()
            step.save(update_fields=["status", "finished_at"])
            return
        is_timeout = "TimeoutError" in error or "timeout" in error.lower()
        step.status = PipelineStepStatus.FAILED
        step.feedback = ("⏱ Agent timed out — click Retry to run again." if is_timeout else error)[:1000]
        step.finished_at = timezone.now()
        step.save()
    _broadcast_step(step)
    _set_run_status(step.run_id, PipelineRunStatus.FAILED)


def retry_step(step_id: int) -> PipelineStep:
    """Create a fresh copy of a failed step and dispatch it.

    Resets the run to RUNNING so the pipeline continues from here.
    Does not restart the entire pipeline.
    """
    with transaction.atomic():
        old = PipelineStep.objects.select_for_update(of=("self",)).select_related("run").get(pk=step_id)
        if old.status != PipelineStepStatus.FAILED:
            return old
        # Mark old step superseded — keep it in history but skip from advance logic.
        old.status = PipelineStepStatus.SKIPPED
        old.save(update_fields=["status"])

        new_step = PipelineStep.objects.create(
            run=old.run,
            role=old.role,
            status=PipelineStepStatus.READY,
            revision=old.revision,         # same revision — it's a retry, not a new revision
            feedback=old.feedback,
            previous_revision=old.previous_revision,
        )
        new_step.depends_on.set(list(old.depends_on.all()))

    # Reset run to RUNNING so the UI reflects active work again.
    _set_run_status(old.run_id, PipelineRunStatus.RUNNING)
    _broadcast_step(new_step)
    _dispatch(new_step)
    return new_step


# ---------------------------------------------------------------------------
# Approve / Reject / Edit
# ---------------------------------------------------------------------------


@transaction.atomic
def approve(step_id: int) -> PipelineStep:
    step = PipelineStep.objects.select_for_update().get(pk=step_id)
    if step.status not in (PipelineStepStatus.AWAITING, PipelineStepStatus.READY):
        return step
    step.status = PipelineStepStatus.DONE
    step.save(update_fields=["status"])
    _broadcast_step(step)
    _advance(step)
    return step


@transaction.atomic
def reject(step_id: int, feedback: str) -> PipelineStep:
    step = PipelineStep.objects.select_for_update().get(pk=step_id)
    if step.status != PipelineStepStatus.AWAITING:
        return step
    step.status = PipelineStepStatus.REJECTED
    step.save(update_fields=["status"])

    # Spawn a new revision step with the same dependencies.
    revision = PipelineStep.objects.create(
        run=step.run,
        role=step.role,
        status=PipelineStepStatus.READY,
        revision=step.revision + 1,
        feedback=feedback,
        previous_revision=step,
    )
    revision.depends_on.set(list(step.depends_on.all()))
    _broadcast_step(step)
    _broadcast_step(revision)
    _dispatch(revision)
    return revision


@transaction.atomic
def cancel_run(run_id: int) -> PipelineRun:
    """Mark a run cancelled and skip any non-terminal pending steps."""
    run = PipelineRun.objects.select_for_update().get(pk=run_id)
    if run.status in (PipelineRunStatus.DONE, PipelineRunStatus.CANCELLED):
        return run
    run.status = PipelineRunStatus.CANCELLED
    run.finished_at = timezone.now()
    run.save(update_fields=["status", "finished_at"])
    for step in run.steps.filter(
        status__in=[
            PipelineStepStatus.PENDING,
            PipelineStepStatus.READY,
            PipelineStepStatus.RUNNING,   # include in-flight steps so nothing stays stuck
            PipelineStepStatus.AWAITING,
            PipelineStepStatus.FAILED,    # also clear failed steps when the whole run is cancelled
        ]
    ):
        step.status = PipelineStepStatus.SKIPPED
        step.save(update_fields=["status"])
        _broadcast_step(step)
    _broadcast_run(run)
    return run


@transaction.atomic
def edit_and_approve(step_id: int, new_content: str) -> PipelineStep:
    """Founder edited the artifact inline — write it back to disk, then advance."""
    step = PipelineStep.objects.select_for_update().get(pk=step_id)
    if step.status != PipelineStepStatus.AWAITING:
        return step
    if step.artifact_path:
        from pathlib import Path

        from apps.artifacts.models import Artifact

        workspace = Path(step.run.pipeline.project.workspace_path)
        target = (workspace / step.artifact_path).resolve()
        if target.is_relative_to(workspace.resolve()):
            target.write_text(new_content, encoding="utf-8")
            Artifact.objects.filter(project=step.run.pipeline.project, path=step.artifact_path).update(
                content_preview=new_content[:2000],
                size_bytes=len(new_content),
            )
    step.status = PipelineStepStatus.DONE
    step.save(update_fields=["status"])
    _broadcast_step(step)
    _advance(step)
    return step


# ---------------------------------------------------------------------------
# Internal: dispatch + advance
# ---------------------------------------------------------------------------


def _advance(step: PipelineStep) -> None:
    """Find downstream steps whose deps are now satisfied and dispatch them."""
    run = step.run
    # Determine if the run is done.
    open_steps = run.steps.exclude(
        status__in=[
            PipelineStepStatus.DONE,
            PipelineStepStatus.SKIPPED,
            PipelineStepStatus.REJECTED,
        ]
    )
    if not open_steps.exists():
        _set_run_status(run.id, PipelineRunStatus.DONE)
        return

    next_steps = list(step.dependents.all())
    for nxt in next_steps:
        if nxt.status != PipelineStepStatus.PENDING:
            continue
        if _deps_satisfied(nxt):
            nxt.status = PipelineStepStatus.READY
            nxt.save(update_fields=["status"])
            _broadcast_step(nxt)
            _dispatch(nxt)

    _set_run_status(run.id, PipelineRunStatus.RUNNING)


def _deps_satisfied(step: PipelineStep) -> bool:
    return not step.depends_on.exclude(status=PipelineStepStatus.DONE).exists()


def _dispatch(step: PipelineStep) -> None:
    """Send the step to the Celery worker to actually run the agent."""
    from apps.agents.tasks import run_pipeline_step_task

    step.status = PipelineStepStatus.RUNNING
    step.started_at = timezone.now()
    step.save(update_fields=["status", "started_at"])
    _broadcast_step(step)

    input_text = _build_input(step)
    run_pipeline_step_task.delay(step.id, input_text)


def _build_input(step: PipelineStep) -> str:
    """Compose the founder-facing input for an agent, including revision feedback."""
    project = step.run.pipeline.project
    base = (
        f"You are part of the project '{project.name}'. The CEO has placed you in a pipeline. "
        f"Do your role's job. Produce your standard artifact in the workspace."
    )
    if step.previous_revision and step.feedback:
        base += (
            f"\n\n--- REVISION (round {step.revision}) ---\n"
            f"Your prior attempt at `{step.previous_revision.artifact_path or 'the artifact'}` was rejected with this feedback:\n\n"
            f"\"{step.feedback}\"\n\n"
            f"Read your previous output (if still on disk), then produce an improved version "
            f"addressing the feedback specifically. Overwrite the same path."
        )
    return base


# ---------------------------------------------------------------------------
# Approval mode predicate
# ---------------------------------------------------------------------------


def _needs_approval(run: PipelineRun, role: str) -> bool:
    mode = run.approval_mode
    if mode == ApprovalMode.SKIP:
        return False
    if mode == ApprovalMode.AFTER_RUN:
        return True
    if mode == ApprovalMode.MILESTONE:
        return role in MILESTONE_ROLES
    if mode == ApprovalMode.PER_ROLE:
        overrides = (run.initiator and getattr(run.initiator, "per_role_approval", {})) or {}
        return overrides.get(role, "after_run") != "skip"
    # EVERY_TOOL_CALL not fully wired yet — fall back to after_run.
    return True


# ---------------------------------------------------------------------------
# Broadcasting
# ---------------------------------------------------------------------------


def _set_run_status(run_id: int, status: str) -> None:
    run = PipelineRun.objects.get(pk=run_id)
    if run.status == status:
        return
    run.status = status
    if status in (PipelineRunStatus.DONE, PipelineRunStatus.FAILED, PipelineRunStatus.CANCELLED):
        run.finished_at = timezone.now()
    run.save(update_fields=["status", "finished_at"])
    _broadcast_run(run)


def _broadcast_run(run: PipelineRun) -> None:
    push(
        run.pipeline.project_id,
        {
            "type": "pipeline_run",
            "run_id": run.id,
            "pipeline_id": run.pipeline_id,
            "status": run.status,
            "approval_mode": run.approval_mode,
        },
    )


def _broadcast_step(step: PipelineStep) -> None:
    push(
        step.run.pipeline.project_id,
        {
            "type": "pipeline_step",
            "step_id": step.id,
            "run_id": step.run_id,
            "role": step.role,
            "status": step.status,
            "revision": step.revision,
            "artifact_path": step.artifact_path,
            "feedback": step.feedback,
        },
    )
