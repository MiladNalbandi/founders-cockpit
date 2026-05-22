from __future__ import annotations

from django.db import models
from django.utils import timezone


class ChatThread(models.Model):
    KIND_CHOICES = [
        ("buddy", "Buddy"),
        ("agent", "Per-agent"),
    ]
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="chat_threads"
    )
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default="buddy")
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat_threads",
    )
    title = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)


class ChatMessage(models.Model):
    ROLE_CHOICES = [("user", "user"), ("assistant", "assistant")]
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("created_at",)
