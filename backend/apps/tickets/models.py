from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class TicketStatus(models.TextChoices):
    CREATED = "created"
    TRIAGED = "triaged"  # assigned and queued
    IN_PROGRESS = "in_progress"  # agent is actively running
    IN_REVIEW = "in_review"  # agent finished; awaiting founder approval
    DONE = "done"
    REJECTED = "rejected"  # founder rejected; a child revision exists


class TicketPriority(models.TextChoices):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Ticket(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="tickets"
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    assignee_role = models.CharField(max_length=32, blank=True, default="")
    status = models.CharField(max_length=16, choices=TicketStatus.choices, default=TicketStatus.CREATED)
    priority = models.CharField(max_length=12, choices=TicketPriority.choices, default=TicketPriority.MEDIUM)
    parent_ticket = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    # Who created the ticket. Either an agent role (str) or a user, or both.
    created_by_role = models.CharField(max_length=32, blank=True, default="")
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets_created",
    )
    # The agent run that worked on this ticket (set when status moves past triaged).
    agent_run = models.ForeignKey(
        "agents.AgentRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
    )
    artifact_path = models.CharField(max_length=500, blank=True, default="")
    feedback = models.TextField(blank=True, default="")
    revision = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)


class TicketEvent(models.Model):
    KIND_CHOICES = [
        ("created", "Created"),
        ("status_changed", "Status changed"),
        ("assigned", "Assigned"),
        ("comment", "Comment"),
        ("artifact", "Artifact written"),
    ]
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    summary = models.CharField(max_length=400, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    actor_role = models.CharField(max_length=32, blank=True, default="")
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("created_at",)
