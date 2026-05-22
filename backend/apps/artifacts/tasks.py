"""Background tasks for artifact post-processing."""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings

log = logging.getLogger(__name__)


@shared_task(name="artifacts.summarize_preview_version")
def summarize_preview_version(version_id: int, prev_html: str, new_html: str) -> dict:
    """Generate a short plain-English summary of what changed between versions.

    Cheap one-shot Claude call; capped output; fails silently — the version
    row was already created with an empty summary, so this only improves UX.
    """
    from .models import PreviewVersion

    try:
        version = PreviewVersion.objects.select_related("project__owner").get(pk=version_id)
    except PreviewVersion.DoesNotExist:
        return {"ok": False, "error": "version not found"}

    if not prev_html:
        summary = "First preview version."
        _save_and_broadcast(version, summary)
        return {"ok": True, "summary": summary}

    try:
        summary = _claude_summarize(version.project.owner, prev_html, new_html)
    except Exception as exc:  # noqa: BLE001
        log.exception("preview summary generation failed: %s", exc)
        return {"ok": False, "error": str(exc)}

    _save_and_broadcast(version, summary)
    return {"ok": True, "summary": summary}


def _save_and_broadcast(version, summary: str) -> None:
    version.summary = (summary or "")[:400]
    version.save(update_fields=["summary"])
    from apps.agents.broadcast import push

    push(
        version.project_id,
        {
            "type": "preview_version",
            "version": version.version,
            "author_role": version.author_role,
            "summary": version.summary,
            "created_at": version.created_at.isoformat(),
        },
    )


def _claude_summarize(user, prev_html: str, new_html: str) -> str:
    """Tiny one-shot using whichever agent backend is configured."""
    prompt = (
        "Two consecutive versions of a single-page HTML demo are below. "
        "In ONE short sentence (max 25 words), describe the visible change. "
        "Focus on user-facing differences (copy, layout, color, behavior) — "
        "ignore minor markup reshuffling.\n\n"
        f"--- PREVIOUS ---\n{prev_html[-6000:]}\n\n"
        f"--- NEW ---\n{new_html[-6000:]}\n\n"
        "Sentence:"
    )
    if settings.AGENT_BACKEND == "claude_sdk":
        return _summarize_via_sdk(prompt)
    return _summarize_via_api(user, prompt)


def _summarize_via_sdk(prompt: str) -> str:
    """Use the local Claude CLI via the agent SDK for a fire-and-forget query."""
    import asyncio

    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        ClaudeSDKClient,
        TextBlock,
    )

    async def _go() -> str:
        options = ClaudeAgentOptions(
            system_prompt="You write tight, neutral one-sentence summaries.",
            allowed_tools=[],
            permission_mode="acceptEdits",
        )
        out: list[str] = []
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock) and block.text:
                            out.append(block.text)
        return " ".join(out).strip()

    return asyncio.run(asyncio.wait_for(_go(), timeout=30))


def _summarize_via_api(user, prompt: str) -> str:
    import anthropic

    api_key = (
        getattr(user, "anthropic_api_key", "")
        or settings.ANTHROPIC_API_KEY
    )
    if not api_key:
        return ""
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=settings.ANTHROPIC_DEFAULT_MODEL,
        max_tokens=120,
        system="You write tight, neutral one-sentence summaries.",
        messages=[{"role": "user", "content": prompt}],
    )
    parts = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
    return " ".join(parts).strip()
