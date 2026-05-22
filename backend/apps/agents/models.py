from __future__ import annotations

from django.db import models
from django.utils import timezone


class AgentRole(models.TextChoices):
    CEO = "ceo", "CEO / Orchestrator"
    PRODUCT = "product", "Product Strategist"
    DESIGNER = "designer", "UI/UX Designer"
    ENGINEER = "engineer", "Engineering Lead"
    FRONTEND_ENG = "frontend_eng", "Frontend Engineer"
    BACKEND_ENG = "backend_eng", "Backend Engineer"
    QA_ENG = "qa_eng", "QA Engineer"
    MARKETER = "marketer", "Marketing Lead"
    ENGAGEMENT = "engagement", "Engagement Lead"
    ANALYST = "analyst", "Analytics Lead"
    RELEASE = "release", "Release / Ops Lead"
    BUDDY = "buddy", "Buddy Advisor"


class AgentStatus(models.TextChoices):
    IDLE = "idle"
    THINKING = "thinking"
    WORKING = "working"
    BLOCKED = "blocked"
    DONE = "done"
    ERROR = "error"


class Agent(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="agents"
    )
    role = models.CharField(max_length=32, choices=AgentRole.choices)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )
    status = models.CharField(
        max_length=16, choices=AgentStatus.choices, default=AgentStatus.IDLE
    )
    current_task = models.CharField(max_length=400, blank=True, default="")
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = (("project", "role"),)

    def __str__(self) -> str:
        return f"{self.project_id}:{self.role}"

    @property
    def display_name(self) -> str:
        return self.get_role_display()


class AgentRun(models.Model):
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="runs")
    input = models.TextField()
    output = models.TextField(blank=True, default="")
    error = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)

    class Meta:
        ordering = ("-started_at",)


class AgentEvent(models.Model):
    """Append-only log of what each agent did (tool calls, text, errors).

    These are the rows behind the ActivityFeed UI.
    """

    KIND_CHOICES = [
        ("status", "status change"),
        ("thought", "model text"),
        ("tool_call", "tool invocation"),
        ("tool_result", "tool result"),
        ("artifact", "artifact written"),
        ("error", "error"),
    ]
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="events")
    run = models.ForeignKey(
        AgentRun, on_delete=models.CASCADE, related_name="events", null=True, blank=True
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    summary = models.CharField(max_length=400, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-created_at",)
