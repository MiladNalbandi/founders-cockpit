from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone


class Project(models.Model):
    """A founder's startup project. Owns a workspace dir + an agent org."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=200)
    idea = models.TextField(blank=True, help_text="The founder's one-paragraph pitch.")
    target_platforms = models.JSONField(
        default=list, blank=True, help_text="Subset of ['web', 'ios', 'android']."
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.owner.email} / {self.name}"

    @property
    def workspace_path(self) -> Path:
        path = settings.WORKSPACES_ROOT / str(self.owner_id) / str(self.id)
        path.mkdir(parents=True, exist_ok=True)
        return path
