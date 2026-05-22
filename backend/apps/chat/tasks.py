"""Celery tasks for Buddy chat streaming."""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings

from apps.agents.broadcast import chat_complete, chat_token

from .models import ChatMessage, ChatThread


def _stream_buddy_reply(*args, **kwargs):
    if settings.AGENT_BACKEND == "claude_sdk":
        from apps.agents.runtime_sdk import stream_buddy_reply as fn
    else:
        from apps.agents.runtime import stream_buddy_reply as fn
    return fn(*args, **kwargs)

log = logging.getLogger(__name__)


@shared_task(name="chat.process_buddy_message")
def process_buddy_message(thread_id: int, user_message_id: int) -> dict:
    thread = ChatThread.objects.select_related("project", "project__owner").get(pk=thread_id)
    user_msg = ChatMessage.objects.get(pk=user_message_id)

    history_msgs = (
        thread.messages.exclude(pk=user_msg.pk)
        .order_by("created_at")
        .values("role", "content")
    )
    history = [{"role": m["role"], "content": m["content"]} for m in history_msgs]

    def on_token(delta: str) -> None:
        chat_token(thread_id, thread.project_id, delta)

    try:
        text = _stream_buddy_reply(
            project=thread.project,
            user_message_text=user_msg.content,
            history=history,
            thread_id=thread_id,
            on_token=on_token,
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("buddy stream failed")
        text = f"_(buddy error: {exc})_"
        on_token(text)

    assistant_msg = ChatMessage.objects.create(thread=thread, role="assistant", content=text)
    chat_complete(thread_id, thread.project_id, assistant_msg.id)
    return {"ok": True, "message_id": assistant_msg.id}
