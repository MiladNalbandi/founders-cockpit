"""Helpers to push real-time updates to the Cockpit UI via Channels."""
from __future__ import annotations

from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def project_group(project_id: int) -> str:
    return f"project_{project_id}"


def push(project_id: int, payload: dict[str, Any]) -> None:
    """Fire-and-forget broadcast to all WS subscribers of this project."""
    layer = get_channel_layer()
    if layer is None:  # pragma: no cover
        return
    async_to_sync(layer.group_send)(
        project_group(project_id),
        {"type": "project.event", "data": payload},
    )


def agent_status_changed(agent) -> None:
    push(
        agent.project_id,
        {
            "type": "agent_status",
            "agent_id": agent.id,
            "role": agent.role,
            "status": agent.status,
            "current_task": agent.current_task,
        },
    )


def agent_event(event) -> None:
    push(
        event.agent.project_id,
        {
            "type": "agent_event",
            "agent_id": event.agent_id,
            "role": event.agent.role,
            "kind": event.kind,
            "summary": event.summary,
            "payload": event.payload,
            "created_at": event.created_at.isoformat(),
        },
    )


def chat_token(thread_id: int, project_id: int, delta: str) -> None:
    push(project_id, {"type": "chat_token", "thread_id": thread_id, "delta": delta})


def chat_complete(thread_id: int, project_id: int, message_id: int) -> None:
    push(
        project_id,
        {"type": "chat_complete", "thread_id": thread_id, "message_id": message_id},
    )
