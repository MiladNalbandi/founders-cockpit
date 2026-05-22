"""Alternate agent runtime that uses the Claude Agent SDK.

Authenticates via the already-logged-in `claude` CLI on the host, so requests
are billed against the user's Claude Pro/Max subscription rather than an API
key. Single-user — the SDK shares a single OAuth token in ``~/.claude/``.

Mirrors the surface of ``runtime.py``:

  - ``run_agent(agent_id, user_input) -> dict``
  - ``stream_buddy_reply(project, text, history, thread_id, on_token) -> str``

The SDK's *built-in* tools (Read, Write, Edit, Bash, Glob, Grep, …) operate
inside the project workspace, since we set ``cwd`` on the SDK client. We
therefore don't need our custom ``apps.agents.tools`` implementations here.
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Callable

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)
from django.conf import settings
from django.utils import timezone

from apps.artifacts.models import Artifact, ArtifactKind

from .broadcast import agent_event as broadcast_event
from .broadcast import agent_status_changed
from .models import Agent, AgentEvent, AgentRun, AgentStatus
from .registry import role_spec

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool allowlist per role — uses SDK-native tool names.
# ---------------------------------------------------------------------------

WRITE_TOOLS = ["Read", "Write", "Glob", "Grep"]
EDIT_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"]
ENG_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"]  # no Bash — founder runs install themselves
READ_ONLY = ["Read", "Glob", "Grep"]

ALLOWED_TOOLS_BY_ROLE: dict[str, list[str]] = {
    "ceo": READ_ONLY,
    "product": WRITE_TOOLS,
    "designer": WRITE_TOOLS,
    "engineer": WRITE_TOOLS,  # Eng Lead only writes ticket JSON + plan.md
    "frontend_eng": ENG_TOOLS,
    "backend_eng": ENG_TOOLS,
    "qa_eng": ENG_TOOLS,
    "marketer": EDIT_TOOLS,
    "engagement": EDIT_TOOLS,
    "analyst": EDIT_TOOLS,
    "release": EDIT_TOOLS,
    "buddy": READ_ONLY,
}


# ---------------------------------------------------------------------------
# Status & event helpers (same shape as runtime.py)
# ---------------------------------------------------------------------------


def _set_status(agent: Agent, status: str, current_task: str = "") -> None:
    agent.status = status
    agent.current_task = current_task[:400]
    agent.last_activity_at = timezone.now()
    agent.save(update_fields=["status", "current_task", "last_activity_at"])
    agent_status_changed(agent)


def _log_event(agent: Agent, run: AgentRun | None, kind: str, summary: str, payload: dict | None = None) -> AgentEvent:
    event = AgentEvent.objects.create(
        agent=agent, run=run, kind=kind, summary=summary[:400], payload=payload or {}
    )
    broadcast_event(event)
    return event


def _record_artifact(agent: Agent, rel_path: str, content: str) -> None:
    """Re-scan the workspace and persist any file the SDK just touched."""
    workspace = Path(agent.project.workspace_path)
    abs_path = workspace / rel_path
    Artifact.objects.update_or_create(
        project=agent.project,
        path=rel_path,
        defaults={
            "agent": agent,
            "kind": ArtifactKind.guess_from_path(rel_path),
            "content_preview": content[:2000],
            "size_bytes": len(content),
            "abs_path": str(abs_path),
        },
    )
    # V3.3: snapshot every preview/index.html change as a PreviewVersion.
    if rel_path == "preview/index.html":
        _snapshot_preview_version(agent, content)


def _snapshot_preview_version(agent: Agent, content: str) -> None:
    """Create a new PreviewVersion row and broadcast a WS event."""
    from apps.artifacts.models import PreviewVersion

    project = agent.project
    prev = PreviewVersion.objects.filter(project=project).order_by("-version").first()
    if prev and prev.html_content == content:
        # No actual change — don't create a duplicate version.
        return
    next_version = (prev.version + 1) if prev else 1
    version = PreviewVersion.objects.create(
        project=project,
        version=next_version,
        html_content=content,
        author_role=agent.role,
    )
    # Best-effort summary (async, capped); failures are silent.
    try:
        _enqueue_summary(version.id, prev.html_content if prev else "", content)
    except Exception:  # noqa: BLE001
        log.exception("could not enqueue preview summary task")
    # Broadcast immediately even before the summary lands.
    from .broadcast import push

    push(
        project.id,
        {
            "type": "preview_version",
            "version": version.version,
            "author_role": version.author_role,
            "summary": version.summary,
            "created_at": version.created_at.isoformat(),
        },
    )


def _enqueue_summary(version_id: int, prev_html: str, new_html: str) -> None:
    """Fire-and-forget Claude one-shot to summarize what changed."""
    from apps.artifacts.tasks import summarize_preview_version

    summarize_preview_version.delay(version_id, prev_html[-8000:], new_html[-8000:])


def _try_extract_relpath(workspace: Path, tool_input: dict[str, Any]) -> str | None:
    """SDK tools use `file_path` (Write/Edit) or `path` (Read). Normalize."""
    for key in ("file_path", "path", "filepath"):
        if key in tool_input and isinstance(tool_input[key], str):
            p = Path(tool_input[key])
            try:
                if p.is_absolute():
                    return str(p.relative_to(workspace.resolve()))
                return str(p)
            except ValueError:
                return None
    return None


# ---------------------------------------------------------------------------
# Build the system prompt + initial user message
# ---------------------------------------------------------------------------


def _build_prompt(spec, project, user_input: str) -> str:
    return (
        f"Project: {project.name}\n"
        f"Idea: {project.idea or '(not yet provided)'}\n"
        f"Target platforms: {', '.join(project.target_platforms) or 'web, ios, android'}\n\n"
        f"Founder's request: {user_input}\n\n"
        f"You are working inside this project's workspace as cwd. "
        f"Use the file tools to write outputs into this directory."
    )


# ---------------------------------------------------------------------------
# Async core
# ---------------------------------------------------------------------------


async def _consume_messages(
    client: ClaudeSDKClient,
    agent: Agent,
    run: AgentRun,
    workspace: Path,
) -> str:
    """Drain the SDK's response stream, logging+broadcasting every event."""
    final_text = ""
    in_tokens = out_tokens = 0
    pending_writes: dict[str, str] = {}  # tool_use_id → relpath

    async for msg in client.receive_response():
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    text = block.text or ""
                    if text.strip():
                        await asyncio.to_thread(
                            _log_event, agent, run, "thought", text[:280], {"text": text}
                        )
                        final_text = text  # latest text becomes the run's output
                elif isinstance(block, ToolUseBlock):
                    name = block.name
                    inp = block.input or {}
                    summary = f"{name}({_short_args(inp)})"
                    await asyncio.to_thread(
                        _log_event,
                        agent,
                        run,
                        "tool_call",
                        summary,
                        {"tool": name, "input": _trim(inp)},
                    )
                    if name in ("Write", "Edit"):
                        rp = _try_extract_relpath(workspace, inp)
                        if rp:
                            pending_writes[block.id] = rp
                    await asyncio.to_thread(
                        _set_status, agent, AgentStatus.WORKING, current_task=summary
                    )
        elif isinstance(msg, UserMessage):
            # Contains tool results returned to the model.
            for block in getattr(msg, "content", []) or []:
                if isinstance(block, ToolResultBlock):
                    is_error = bool(getattr(block, "is_error", False))
                    raw = getattr(block, "content", "") or ""
                    text_summary = _render_tool_result(raw)
                    await asyncio.to_thread(
                        _log_event,
                        agent,
                        run,
                        "tool_result",
                        ("ERROR: " if is_error else "") + text_summary[:200],
                        {"is_error": is_error, "preview": text_summary[:1500]},
                    )
                    rp = pending_writes.pop(block.tool_use_id, None)
                    if rp and not is_error:
                        # Re-read what's now on disk to capture the preview.
                        try:
                            abs_path = workspace / rp
                            preview = abs_path.read_text(
                                encoding="utf-8", errors="replace"
                            )
                        except Exception:
                            preview = ""
                        await asyncio.to_thread(_record_artifact, agent, rp, preview)
                        await asyncio.to_thread(
                            _log_event,
                            agent,
                            run,
                            "artifact",
                            f"wrote {rp}",
                            {"path": rp},
                        )
        elif isinstance(msg, ResultMessage):
            usage = getattr(msg, "usage", {}) or {}
            in_tokens = int(usage.get("input_tokens", 0) or 0)
            out_tokens = int(usage.get("output_tokens", 0) or 0)
            if getattr(msg, "result", None):
                final_text = msg.result

    run.input_tokens = in_tokens
    run.output_tokens = out_tokens
    return final_text


async def _run_async(agent_id: int, user_input: str) -> dict[str, Any]:
    agent: Agent = await asyncio.to_thread(
        lambda: Agent.objects.select_related("project", "project__owner").get(pk=agent_id)
    )
    spec = role_spec(agent.role)
    workspace = Path(agent.project.workspace_path).resolve()
    workspace.mkdir(parents=True, exist_ok=True)

    run: AgentRun = await asyncio.to_thread(
        lambda: AgentRun.objects.create(agent=agent, input=user_input)
    )
    await asyncio.to_thread(_set_status, agent, AgentStatus.THINKING, current_task=user_input[:120])
    await asyncio.to_thread(_log_event, agent, run, "status", f"{spec.display_name} started")

    is_buddy = agent.role == "buddy"
    model = (
        settings.CLAUDE_SDK_BUDDY_MODEL if is_buddy else settings.CLAUDE_SDK_MODEL
    ) or None

    options = ClaudeAgentOptions(
        system_prompt=spec.system_prompt,
        cwd=str(workspace),
        allowed_tools=ALLOWED_TOOLS_BY_ROLE.get(agent.role, READ_ONLY),
        permission_mode="acceptEdits",
        model=model,
    )

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(_build_prompt(spec, agent.project, user_input))
            final_text = await asyncio.wait_for(
                _consume_messages(client, agent, run, workspace),
                timeout=settings.AGENT_RUN_TIMEOUT_SECONDS,
            )
        run.output = final_text
        run.finished_at = timezone.now()
        await asyncio.to_thread(run.save)
        await asyncio.to_thread(_set_status, agent, AgentStatus.DONE, current_task="finished")
        await asyncio.to_thread(
            _log_event, agent, run, "status", "completed", {"final_text": final_text[:1000]}
        )
        return {"ok": True, "run_id": run.id, "output": final_text}
    except Exception as exc:  # noqa: BLE001
        log.exception("SDK agent run failed")
        err = f"{type(exc).__name__}: {exc}"
        run.error = err
        run.finished_at = timezone.now()
        await asyncio.to_thread(run.save)
        await asyncio.to_thread(_log_event, agent, run, "error", err)
        await asyncio.to_thread(_set_status, agent, AgentStatus.ERROR, current_task=err[:120])
        return {"ok": False, "error": err}


def run_agent(agent_id: int, user_input: str) -> dict[str, Any]:
    return asyncio.run(_run_async(agent_id, user_input))


# ---------------------------------------------------------------------------
# Buddy streaming
# ---------------------------------------------------------------------------


async def _buddy_async(project, user_message_text: str, history: list[dict], on_token) -> str:
    spec = role_spec("buddy")
    workspace = Path(project.workspace_path).resolve()
    workspace.mkdir(parents=True, exist_ok=True)

    system_prompt = (
        spec.system_prompt
        + f"\n\nProject context — name: {project.name}; idea: {project.idea or '(not provided)'}."
    )

    # Convert prior history into a single conversational lead-in for the SDK.
    history_text = ""
    for m in history[-10:]:
        role = "Founder" if m["role"] == "user" else "You"
        history_text += f"{role}: {m['content']}\n\n"
    prompt = f"{history_text}Founder: {user_message_text}"

    model = settings.CLAUDE_SDK_BUDDY_MODEL or None
    options = ClaudeAgentOptions(
        system_prompt=system_prompt,
        cwd=str(workspace),
        allowed_tools=READ_ONLY,
        permission_mode="acceptEdits",
        model=model,
    )

    full: list[str] = []
    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock) and block.text:
                        full.append(block.text)
                        # SDK doesn't deliver token-by-token here; emit whole blocks
                        # so the UI still gets streaming feel between blocks.
                        await asyncio.to_thread(on_token, block.text)
            elif isinstance(msg, ResultMessage) and getattr(msg, "result", None):
                # ResultMessage.result may duplicate what we already streamed;
                # only emit the suffix if longer.
                already = "".join(full)
                if msg.result and msg.result != already and len(msg.result) > len(already):
                    suffix = msg.result[len(already) :]
                    full.append(suffix)
                    await asyncio.to_thread(on_token, suffix)
    return "".join(full)


def stream_buddy_reply(
    project, user_message_text: str, history: list[dict], thread_id: int, on_token: Callable[[str], None]
) -> str:
    return asyncio.run(_buddy_async(project, user_message_text, history, on_token))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _short_args(d: dict[str, Any]) -> str:
    parts = []
    for k, v in (d or {}).items():
        if isinstance(v, str):
            shown = v if len(v) < 40 else v[:37] + "…"
        else:
            shown = repr(v)
        parts.append(f"{k}={shown}")
    return ", ".join(parts)[:200]


def _render_tool_result(raw: Any) -> str:
    """Tool results can arrive as str, list[TextBlock], or list[dict]. Flatten."""
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        out = []
        for piece in raw:
            text = getattr(piece, "text", None)
            if text is None and isinstance(piece, dict):
                text = piece.get("text", "")
            out.append(str(text or ""))
        return "".join(out)
    return str(raw)


def _trim(obj: Any, limit: int = 1500) -> Any:
    if isinstance(obj, str):
        return obj if len(obj) <= limit else obj[:limit] + " …[truncated]"
    if isinstance(obj, dict):
        return {k: _trim(v, limit) for k, v in obj.items()}
    return obj
