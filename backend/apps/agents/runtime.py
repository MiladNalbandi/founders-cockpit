"""Core agent loop: Claude messages + tool use, with live WS broadcasting.

Designed to be called from a Celery worker (synchronous). Each call:

  - flips the Agent's status (idle → thinking → working → done/error)
  - logs AgentEvent rows for every text, tool call, tool result
  - broadcasts each transition over Channels
  - persists artifacts the agent wrote to the workspace
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

import anthropic
from django.conf import settings
from django.utils import timezone

from apps.artifacts.models import Artifact, ArtifactKind

from .broadcast import agent_event as broadcast_event
from .broadcast import agent_status_changed
from .models import Agent, AgentEvent, AgentRun, AgentStatus
from .registry import role_spec
from .tools import execute_tool, schemas_for

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Status & event helpers
# ---------------------------------------------------------------------------


def _set_status(agent: Agent, status: str, current_task: str = "") -> None:
    agent.status = status
    agent.current_task = current_task[:400]
    agent.last_activity_at = timezone.now()
    agent.save(update_fields=["status", "current_task", "last_activity_at"])
    agent_status_changed(agent)


def _log_event(
    agent: Agent,
    run: AgentRun | None,
    kind: str,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> AgentEvent:
    event = AgentEvent.objects.create(
        agent=agent,
        run=run,
        kind=kind,
        summary=summary[:400],
        payload=payload or {},
    )
    broadcast_event(event)
    return event


# ---------------------------------------------------------------------------
# Anthropic client
# ---------------------------------------------------------------------------


def _client_for(user) -> anthropic.Anthropic:
    api_key = user.anthropic_api_key or settings.ANTHROPIC_API_KEY
    if not api_key:
        raise RuntimeError(
            "No Anthropic API key. Set the user's key via /api/auth/secrets/ "
            "or export ANTHROPIC_API_KEY on the server."
        )
    return anthropic.Anthropic(api_key=api_key)


# ---------------------------------------------------------------------------
# Message construction
# ---------------------------------------------------------------------------


def _initial_messages(user_input: str, project) -> list[dict]:
    context = (
        f"Project: {project.name}\n"
        f"Idea: {project.idea or '(not yet provided)'}\n"
        f"Target platforms: {', '.join(project.target_platforms) or 'web, ios, android'}\n\n"
        f"Founder's request: {user_input}"
    )
    return [{"role": "user", "content": context}]


# ---------------------------------------------------------------------------
# Tool-use loop
# ---------------------------------------------------------------------------


def _extract_text(content_blocks: list) -> str:
    parts = []
    for block in content_blocks:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "\n".join(parts)


def _record_artifact(agent: Agent, rel_path: str, content: str) -> None:
    kind = ArtifactKind.guess_from_path(rel_path)
    workspace = Path(agent.project.workspace_path)
    abs_path = workspace / rel_path
    Artifact.objects.update_or_create(
        project=agent.project,
        path=rel_path,
        defaults={
            "agent": agent,
            "kind": kind,
            "content_preview": content[:2000],
            "size_bytes": len(content),
            "abs_path": str(abs_path),
        },
    )


def run_agent(agent_id: int, user_input: str) -> dict[str, Any]:
    agent: Agent = Agent.objects.select_related("project", "project__owner").get(pk=agent_id)
    spec = role_spec(agent.role)
    workspace = Path(agent.project.workspace_path)
    started = time.monotonic()

    run = AgentRun.objects.create(agent=agent, input=user_input)
    _set_status(agent, AgentStatus.THINKING, current_task=user_input[:120])
    _log_event(agent, run, "status", f"{spec.display_name} started")

    try:
        client = _client_for(agent.project.owner)
    except RuntimeError as exc:
        _log_event(agent, run, "error", str(exc))
        _set_status(agent, AgentStatus.ERROR, current_task="missing API key")
        run.error = str(exc)
        run.finished_at = timezone.now()
        run.save()
        return {"ok": False, "error": str(exc)}

    model = spec.model_override or settings.ANTHROPIC_DEFAULT_MODEL
    tools = schemas_for(spec.tools)
    messages = _initial_messages(user_input, agent.project)

    total_in = total_out = 0
    final_text = ""

    try:
        for iteration in range(settings.AGENT_RUN_MAX_ITERATIONS):
            if time.monotonic() - started > settings.AGENT_RUN_TIMEOUT_SECONDS:
                raise TimeoutError("agent timeout")

            response = client.messages.create(
                model=model,
                max_tokens=settings.AGENT_RUN_MAX_TOKENS_PER_TURN,
                system=spec.system_prompt,
                tools=tools or anthropic.NOT_GIVEN,
                messages=messages,
            )
            total_in += response.usage.input_tokens
            total_out += response.usage.output_tokens

            text = _extract_text(response.content)
            if text:
                _log_event(agent, run, "thought", text[:280], {"text": text})

            if response.stop_reason != "tool_use":
                final_text = text
                break

            _set_status(agent, AgentStatus.WORKING, current_task="running tools")
            messages.append({"role": "assistant", "content": response.content})

            tool_results = []
            for block in response.content:
                if getattr(block, "type", None) != "tool_use":
                    continue
                tool_name = block.name
                tool_input = block.input or {}
                _log_event(
                    agent,
                    run,
                    "tool_call",
                    f"{tool_name}({_short_args(tool_input)})",
                    {"tool": tool_name, "input": tool_input},
                )
                result = execute_tool(tool_name, workspace, tool_input)
                _log_event(
                    agent,
                    run,
                    "tool_result",
                    _result_summary(tool_name, result),
                    {"tool": tool_name, "result": _sanitize_for_json(result)},
                )
                if tool_name == "fs_write" and result.get("ok"):
                    _record_artifact(agent, tool_input["path"], tool_input.get("content", ""))
                    _log_event(
                        agent,
                        run,
                        "artifact",
                        f"wrote {tool_input['path']}",
                        {"path": tool_input["path"]},
                    )

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result)[:6000],
                        "is_error": not result.get("ok", True),
                    }
                )
            messages.append({"role": "user", "content": tool_results})
            _set_status(agent, AgentStatus.THINKING, current_task="reflecting on tools")
        else:
            _log_event(agent, run, "error", "max iterations reached")

        run.output = final_text
        run.input_tokens = total_in
        run.output_tokens = total_out
        run.finished_at = timezone.now()
        run.save()
        _set_status(agent, AgentStatus.DONE, current_task="finished")
        _log_event(agent, run, "status", "completed", {"final_text": final_text[:1000]})
        return {"ok": True, "run_id": run.id, "output": final_text}

    except Exception as exc:  # noqa: BLE001
        log.exception("agent run failed")
        run.error = f"{type(exc).__name__}: {exc}"
        run.finished_at = timezone.now()
        run.save()
        _log_event(agent, run, "error", run.error)
        _set_status(agent, AgentStatus.ERROR, current_task=str(exc)[:120])
        return {"ok": False, "error": run.error}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _short_args(d: dict[str, Any]) -> str:
    parts = []
    for k, v in d.items():
        if isinstance(v, str):
            v_render = v if len(v) < 40 else v[:37] + "..."
        else:
            v_render = repr(v)
        parts.append(f"{k}={v_render}")
    return ", ".join(parts)[:200]


def _result_summary(tool: str, result: dict[str, Any]) -> str:
    if not result.get("ok", True):
        return f"{tool} → ERROR: {result.get('error', 'unknown')}"
    if tool == "fs_write":
        return f"wrote {result.get('path')} ({result.get('bytes_written')} B)"
    if tool == "fs_read":
        n = len(result.get("content", ""))
        return f"read {result.get('path')} ({n} chars)"
    if tool == "fs_list":
        return f"listed {len(result.get('entries', []))} entries"
    if tool == "shell_exec":
        return f"shell exit={result.get('exit_code')}"
    return f"{tool} → ok"


def _sanitize_for_json(d: dict[str, Any]) -> dict[str, Any]:
    """Trim oversized fields before storing in JSONB."""
    out = {}
    for k, v in d.items():
        if isinstance(v, str) and len(v) > 4000:
            out[k] = v[:4000] + "... [truncated]"
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# Buddy streaming (separate path because we stream tokens to the chat UI)
# ---------------------------------------------------------------------------


def stream_buddy_reply(
    project,
    user_message_text: str,
    history: list[dict],
    thread_id: int,
    on_token,
) -> str:
    """Stream the Buddy's reply, calling ``on_token(delta)`` per chunk.

    Returns the full assembled text. Synchronous (Celery-side).
    """
    spec = role_spec("buddy")
    client = _client_for(project.owner)
    model = spec.model_override or settings.ANTHROPIC_BUDDY_MODEL

    messages = history + [{"role": "user", "content": user_message_text}]
    full = []
    with client.messages.stream(
        model=model,
        max_tokens=settings.AGENT_RUN_MAX_TOKENS_PER_TURN,
        system=spec.system_prompt
        + f"\n\nProject context — name: {project.name}; idea: {project.idea or '(not provided)'}.",
        messages=messages,
    ) as stream:
        for delta in stream.text_stream:
            full.append(delta)
            on_token(delta)
    return "".join(full)
