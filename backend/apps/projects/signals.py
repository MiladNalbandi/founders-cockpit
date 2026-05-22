"""When a Project is created, populate its agent org chart."""
from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Project


@receiver(post_save, sender=Project)
def seed_agents(sender, instance: Project, created: bool, **kwargs):
    if not created:
        return
    # Lazy import to avoid circular at app load.
    from apps.agents.bootstrap import bootstrap_agents_for_project

    bootstrap_agents_for_project(instance)
