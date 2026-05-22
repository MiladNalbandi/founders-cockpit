from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class ApprovalMode(models.TextChoices):
    AFTER_RUN = "after_run", "After every agent run (default)"
    MILESTONE = "milestone", "Only at milestones (PRD, Design, Scaffold, Release)"
    EVERY_TOOL_CALL = "every_tool_call", "Pause on every tool call"
    PER_ROLE = "per_role", "Configured per role"
    SKIP = "skip", "No approval — fully autonomous"


MILESTONE_ROLES = {"product", "designer", "engineer", "release"}


class PipelineRunStatus(models.TextChoices):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING = "awaiting_approval"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PipelineStepStatus(models.TextChoices):
    PENDING = "pending"
    READY = "ready"  # deps satisfied; not yet dispatched
    RUNNING = "running"
    AWAITING = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"  # in revision (a new step exists with revision+1)
    DONE = "done"  # approved + no more revisions
    FAILED = "failed"
    SKIPPED = "skipped"


class Pipeline(models.Model):
    """A reusable DAG template attached to a project.

    template_data shape::
        {"steps": [{"role": "product", "depends_on": []},
                   {"role": "designer", "depends_on": ["product"]}, ...]}
    """

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="pipelines"
    )
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=300, blank=True, default="")
    template_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = (("project", "name"),)
        ordering = ("-created_at",)


class PipelineRun(models.Model):
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="runs")
    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="pipeline_runs",
    )
    status = models.CharField(
        max_length=24, choices=PipelineRunStatus.choices, default=PipelineRunStatus.PENDING
    )
    approval_mode = models.CharField(
        max_length=24, choices=ApprovalMode.choices, default=ApprovalMode.AFTER_RUN
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Optional founder note describing what this run is for.",
    )
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-started_at",)

    @property
    def project_id(self) -> int:
        return self.pipeline.project_id


class PipelineStep(models.Model):
    run = models.ForeignKey(PipelineRun, on_delete=models.CASCADE, related_name="steps")
    role = models.CharField(max_length=32)
    depends_on = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="dependents")
    status = models.CharField(
        max_length=24, choices=PipelineStepStatus.choices, default=PipelineStepStatus.PENDING
    )
    agent_run = models.ForeignKey(
        "agents.AgentRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pipeline_steps",
    )
    revision = models.IntegerField(default=1)
    feedback = models.TextField(blank=True, default="")
    artifact_path = models.CharField(max_length=500, blank=True, default="")
    # Link to a prior step if this is a revision of a rejected step.
    previous_revision = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="next_revisions",
    )
    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("created_at",)


class Approval(models.Model):
    ACTION_CHOICES = [
        ("approve", "Approve"),
        ("reject", "Reject"),
        ("edit", "Edit & approve"),
    ]
    step = models.ForeignKey(PipelineStep, on_delete=models.CASCADE, related_name="approvals")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="approvals"
    )
    action = models.CharField(max_length=12, choices=ACTION_CHOICES)
    comment = models.TextField(blank=True, default="")
    edited_content = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
