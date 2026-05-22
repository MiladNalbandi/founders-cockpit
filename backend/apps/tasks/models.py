from __future__ import annotations

from django.db import models
from django.utils import timezone


class TaskStatus(models.TextChoices):
    BACKLOG = "backlog"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class Department(models.TextChoices):
    PRODUCT = "Product"
    DESIGN = "Design"
    ENGINEERING = "Engineering"
    MARKETING = "Marketing"
    ENGAGEMENT = "Engagement & Retention"
    ANALYTICS = "Analytics"
    RELEASE = "Release & Ops"


class WorkflowTask(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="workflow_tasks"
    )
    department = models.CharField(max_length=64, choices=Department.choices)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, choices=TaskStatus.choices, default=TaskStatus.BACKLOG
    )
    assignee = models.ForeignKey(
        "agents.Agent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("department", "created_at")
