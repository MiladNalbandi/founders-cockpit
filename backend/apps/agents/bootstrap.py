"""Create the full 8-agent org for a new project."""
from __future__ import annotations

from .models import Agent
from .registry import ordered_roles


def bootstrap_agents_for_project(project) -> list[Agent]:
    by_role: dict[str, Agent] = {}
    # Two passes: first create all, then wire parents (since they may be forward refs).
    for spec in ordered_roles():
        agent, _ = Agent.objects.get_or_create(
            project=project, role=spec.role, defaults={"status": "idle"}
        )
        by_role[spec.role] = agent
    for spec in ordered_roles():
        if spec.parent_role:
            agent = by_role[spec.role]
            agent.parent = by_role[spec.parent_role]
            agent.save(update_fields=["parent"])
    return list(by_role.values())
