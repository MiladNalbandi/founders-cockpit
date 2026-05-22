"""Tests for the pipeline orchestrator state machine."""
from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from apps.agents.models import Agent, AgentStatus
from apps.pipelines.models import (
    Pipeline,
    PipelineRun,
    PipelineRunStatus,
    PipelineStep,
    PipelineStepStatus,
)
from apps.pipelines import orchestrator
from apps.projects.models import Project

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="test@cockpit.dev",
        password="test12345",
        full_name="Test Founder",
    )


@pytest.fixture
def project(user):
    # workspace_path is a @property derived from settings; don't pass it to create().
    # The post_save signal auto-bootstraps agents for this project.
    return Project.objects.create(
        owner=user,
        name="Test Startup",
        idea="A test idea.",
    )


@pytest.fixture
def agents(project):
    # Agents are auto-bootstrapped by the post_save signal on Project.
    return {a.role: a for a in project.agents.all()}


@pytest.fixture
def simple_template():
    return {
        "name": "test-pipeline",
        "description": "Two-step test",
        "steps": [
            {"role": "product", "depends_on": []},
            {"role": "designer", "depends_on": ["product"]},
        ],
    }


# ---------------------------------------------------------------------------
# start_pipeline
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_start_pipeline_creates_run_and_steps(user, project, agents, simple_template):
    run = orchestrator.start_pipeline(project, user, template=simple_template)
    assert run.status == PipelineRunStatus.RUNNING
    assert run.steps.count() == 2
    product_step = run.steps.get(role="product")
    assert product_step.status == PipelineStepStatus.RUNNING  # dispatched immediately


@pytest.mark.django_db
def test_start_pipeline_raises_conflict_if_active(user, project, agents, simple_template):
    orchestrator.start_pipeline(project, user, template=simple_template)
    with pytest.raises(orchestrator.PipelineConflict):
        orchestrator.start_pipeline(project, user, template=simple_template)


@pytest.mark.django_db
def test_start_pipeline_cancels_old_run_when_flag_set(user, project, agents, simple_template):
    run1 = orchestrator.start_pipeline(project, user, template=simple_template)
    run2 = orchestrator.start_pipeline(
        project, user, template=simple_template, cancel_running=True
    )
    run1.refresh_from_db()
    assert run1.status == PipelineRunStatus.CANCELLED
    assert run2.status == PipelineRunStatus.RUNNING


# ---------------------------------------------------------------------------
# cancel_run — stuck steps
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_cancel_run_marks_running_steps_skipped(user, project, agents, simple_template):
    """Steps in RUNNING state must be skipped when the run is cancelled (regression for the
    stuck-step bug where cancel_run only skipped PENDING/READY/AWAITING steps)."""
    run = orchestrator.start_pipeline(project, user, template=simple_template)
    product_step = run.steps.get(role="product")
    assert product_step.status == PipelineStepStatus.RUNNING

    orchestrator.cancel_run(run.id)

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.SKIPPED


@pytest.mark.django_db
def test_cancel_run_marks_failed_steps_skipped(user, project, agents, simple_template):
    run = orchestrator.start_pipeline(project, user, template=simple_template)
    product_step = run.steps.get(role="product")
    # Simulate a failure before cancel.
    product_step.status = PipelineStepStatus.FAILED
    product_step.save(update_fields=["status"])

    orchestrator.cancel_run(run.id)

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.SKIPPED


# ---------------------------------------------------------------------------
# complete_step — cancelled-run guard
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_complete_step_ignores_cancelled_run(user, project, agents, simple_template):
    """If complete_step is called after the run was cancelled, it must not re-activate it."""
    run = orchestrator.start_pipeline(project, user, template=simple_template)
    product_step = run.steps.get(role="product")

    orchestrator.cancel_run(run.id)
    run.refresh_from_db()
    assert run.status == PipelineRunStatus.CANCELLED

    # Simulate late-arriving completion from a Celery task.
    orchestrator.complete_step(product_step.id, agent_run_id=None, artifact_path=None)

    run.refresh_from_db()
    # Run must remain cancelled — not re-opened.
    assert run.status == PipelineRunStatus.CANCELLED
    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.SKIPPED


# ---------------------------------------------------------------------------
# complete_step → approval gate → advance
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_complete_step_awaiting_when_approval_mode_after_run(user, project, agents, simple_template):
    user.default_approval_mode = "after_run"
    user.save(update_fields=["default_approval_mode"])

    run = orchestrator.start_pipeline(project, user, template=simple_template)
    product_step = run.steps.get(role="product")

    orchestrator.complete_step(product_step.id, agent_run_id=None, artifact_path="docs/PRD.md")

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.AWAITING
    assert product_step.artifact_path == "docs/PRD.md"

    run.refresh_from_db()
    assert run.status == PipelineRunStatus.AWAITING


@pytest.mark.django_db
def test_complete_step_auto_advances_when_skip_mode(user, project, agents, simple_template):
    user.default_approval_mode = "skip"
    user.save(update_fields=["default_approval_mode"])

    run = orchestrator.start_pipeline(
        project, user, template=simple_template, approval_mode="skip"
    )
    product_step = run.steps.get(role="product")

    orchestrator.complete_step(product_step.id, agent_run_id=None, artifact_path=None)

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.DONE

    # Designer should have been dispatched automatically.
    designer_step = run.steps.get(role="designer")
    designer_step.refresh_from_db()
    assert designer_step.status == PipelineStepStatus.RUNNING


# ---------------------------------------------------------------------------
# approve / reject / retry
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_approve_advances_pipeline(user, project, agents, simple_template):
    run = orchestrator.start_pipeline(
        project, user, template=simple_template, approval_mode="after_run"
    )
    product_step = run.steps.get(role="product")
    orchestrator.complete_step(product_step.id, None, None)
    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.AWAITING

    orchestrator.approve(product_step.id)

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.DONE
    designer_step = run.steps.get(role="designer")
    designer_step.refresh_from_db()
    assert designer_step.status == PipelineStepStatus.RUNNING


@pytest.mark.django_db
def test_reject_creates_revision_step(user, project, agents, simple_template):
    run = orchestrator.start_pipeline(
        project, user, template=simple_template, approval_mode="after_run"
    )
    product_step = run.steps.get(role="product")
    orchestrator.complete_step(product_step.id, None, None)

    new_step = orchestrator.reject(product_step.id, feedback="Make it shorter.")

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.REJECTED
    assert new_step.role == "product"
    assert new_step.revision == 2
    assert new_step.feedback == "Make it shorter."
    assert new_step.status == PipelineStepStatus.RUNNING


@pytest.mark.django_db
def test_retry_failed_step(user, project, agents, simple_template):
    run = orchestrator.start_pipeline(
        project, user, template=simple_template, approval_mode="after_run"
    )
    product_step = run.steps.get(role="product")

    # Simulate a timeout failure.
    orchestrator.fail_step(product_step.id, "TimeoutError: agent timed out")
    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.FAILED
    assert "timed out" in product_step.feedback

    new_step = orchestrator.retry_step(product_step.id)

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.SKIPPED
    assert new_step.role == "product"
    assert new_step.status == PipelineStepStatus.RUNNING

    run.refresh_from_db()
    assert run.status == PipelineRunStatus.RUNNING


@pytest.mark.django_db
def test_fail_step_sets_timeout_message(user, project, agents, simple_template):
    run = orchestrator.start_pipeline(project, user, template=simple_template)
    product_step = run.steps.get(role="product")

    orchestrator.fail_step(product_step.id, "TimeoutError: ")

    product_step.refresh_from_db()
    assert product_step.status == PipelineStepStatus.FAILED
    assert "timed out" in product_step.feedback


# ---------------------------------------------------------------------------
# Parallel dispatch
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_parallel_steps_dispatch_together(user, project, agents):
    """frontend_eng and backend_eng should both dispatch when engineer step completes."""
    template = {
        "name": "parallel-test",
        "description": "Parallel eng test",
        "steps": [
            {"role": "engineer", "depends_on": []},
            {"role": "frontend_eng", "depends_on": ["engineer"]},
            {"role": "backend_eng", "depends_on": ["engineer"]},
        ],
    }
    run = orchestrator.start_pipeline(
        project, user, template=template, approval_mode="skip"
    )
    eng_step = run.steps.get(role="engineer")

    orchestrator.complete_step(eng_step.id, None, None)

    fe = run.steps.get(role="frontend_eng")
    be = run.steps.get(role="backend_eng")
    fe.refresh_from_db()
    be.refresh_from_db()
    assert fe.status == PipelineStepStatus.RUNNING
    assert be.status == PipelineStepStatus.RUNNING
