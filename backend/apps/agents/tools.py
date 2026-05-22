"""Tool schemas + execution for the agent runtime.

Each tool has:
  - a JSON-schema definition (sent to Claude)
  - an ``execute_<name>`` function (run server-side, scoped to project workspace)

All filesystem operations are path-traversal guarded.
"""
from __future__ import annotations

import shlex
import subprocess
from pathlib import Path
from typing import Any, Callable

MAX_READ_BYTES = 200_000
MAX_LIST_ENTRIES = 200
SHELL_ALLOWLIST = {
    "python",
    "python3",
    "pip",
    "uv",
    "npm",
    "npx",
    "node",
    "git",
    "mkdir",
    "ls",
    "cat",
    "echo",
    "pwd",
}
SHELL_TIMEOUT_SEC = 60


# ---------------------------------------------------------------------------
# Tool schemas (the JSON Claude sees)
# ---------------------------------------------------------------------------

TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "fs_write": {
        "name": "fs_write",
        "description": "Write a UTF-8 text file inside the project workspace. Creates parent directories. Overwrites existing files.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path relative to the workspace, e.g. 'docs/PRD.md'."},
                "content": {"type": "string", "description": "Full file contents."},
            },
            "required": ["path", "content"],
        },
    },
    "fs_read": {
        "name": "fs_read",
        "description": "Read a UTF-8 text file inside the project workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path relative to the workspace."},
            },
            "required": ["path"],
        },
    },
    "fs_list": {
        "name": "fs_list",
        "description": "List entries in a directory inside the project workspace.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory path relative to workspace. Empty string for root.", "default": ""},
            },
        },
    },
    "shell_exec": {
        "name": "shell_exec",
        "description": (
            "Run a shell command inside the project workspace. "
            f"Only these binaries are allowed: {sorted(SHELL_ALLOWLIST)}. "
            "Output is truncated to 8 KB."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "cmd": {"type": "string", "description": "Full command line."},
            },
            "required": ["cmd"],
        },
    },
    "git_init": {
        "name": "git_init",
        "description": "Initialize a git repository at the workspace root if absent.",
        "input_schema": {"type": "object", "properties": {}},
    },
    "git_commit": {
        "name": "git_commit",
        "description": "Stage all and commit with the given message inside the workspace repo.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
            },
            "required": ["message"],
        },
    },
}


# ---------------------------------------------------------------------------
# Path safety
# ---------------------------------------------------------------------------


def _safe_join(workspace: Path, rel: str) -> Path:
    """Resolve ``rel`` against ``workspace`` and assert containment."""
    workspace = workspace.resolve()
    target = (workspace / rel).resolve()
    try:
        target.relative_to(workspace)
    except ValueError as exc:
        raise PermissionError(f"path escapes workspace: {rel!r}") from exc
    return target


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


def execute_fs_write(workspace: Path, path: str, content: str) -> dict[str, Any]:
    target = _safe_join(workspace, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return {"ok": True, "bytes_written": len(content), "path": path}


def execute_fs_read(workspace: Path, path: str) -> dict[str, Any]:
    target = _safe_join(workspace, path)
    if not target.exists():
        return {"ok": False, "error": "not_found", "path": path}
    if target.is_dir():
        return {"ok": False, "error": "is_directory", "path": path}
    data = target.read_bytes()[:MAX_READ_BYTES]
    return {
        "ok": True,
        "path": path,
        "content": data.decode("utf-8", errors="replace"),
        "truncated": len(data) >= MAX_READ_BYTES,
    }


def execute_fs_list(workspace: Path, path: str = "") -> dict[str, Any]:
    target = _safe_join(workspace, path or "")
    if not target.exists():
        return {"ok": True, "path": path, "entries": []}
    if not target.is_dir():
        return {"ok": False, "error": "not_a_directory"}
    entries = []
    for child in sorted(target.iterdir())[:MAX_LIST_ENTRIES]:
        entries.append(
            {
                "name": child.name,
                "kind": "dir" if child.is_dir() else "file",
                "size": child.stat().st_size if child.is_file() else None,
            }
        )
    return {"ok": True, "path": path, "entries": entries}


def execute_shell_exec(workspace: Path, cmd: str) -> dict[str, Any]:
    try:
        argv = shlex.split(cmd)
    except ValueError as exc:
        return {"ok": False, "error": f"bad command syntax: {exc}"}
    if not argv:
        return {"ok": False, "error": "empty command"}
    bin_name = Path(argv[0]).name
    if bin_name not in SHELL_ALLOWLIST:
        return {"ok": False, "error": f"command not permitted: {bin_name}"}
    try:
        proc = subprocess.run(
            argv,
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=SHELL_TIMEOUT_SEC,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    return {
        "ok": True,
        "exit_code": proc.returncode,
        "stdout": (proc.stdout or "")[:8192],
        "stderr": (proc.stderr or "")[:8192],
    }


def execute_git_init(workspace: Path) -> dict[str, Any]:
    if (workspace / ".git").exists():
        return {"ok": True, "already_initialized": True}
    return execute_shell_exec(workspace, "git init")


def execute_git_commit(workspace: Path, message: str) -> dict[str, Any]:
    add = execute_shell_exec(workspace, "git add -A")
    if not add.get("ok"):
        return add
    cfg1 = execute_shell_exec(workspace, "git -c user.email=cockpit@local -c user.name=Cockpit commit --allow-empty -m " + shlex.quote(message))
    return cfg1


TOOL_EXECUTORS: dict[str, Callable[..., dict[str, Any]]] = {
    "fs_write": execute_fs_write,
    "fs_read": execute_fs_read,
    "fs_list": execute_fs_list,
    "shell_exec": execute_shell_exec,
    "git_init": execute_git_init,
    "git_commit": execute_git_commit,
}


def schemas_for(tool_names: list[str]) -> list[dict[str, Any]]:
    return [TOOL_SCHEMAS[n] for n in tool_names if n in TOOL_SCHEMAS]


def execute_tool(name: str, workspace: Path, input_dict: dict[str, Any]) -> dict[str, Any]:
    fn = TOOL_EXECUTORS.get(name)
    if not fn:
        return {"ok": False, "error": f"unknown tool: {name}"}
    try:
        return fn(workspace, **input_dict)
    except PermissionError as exc:
        return {"ok": False, "error": str(exc)}
    except TypeError as exc:
        return {"ok": False, "error": f"bad arguments: {exc}"}
    except Exception as exc:  # pragma: no cover  (defensive)
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
