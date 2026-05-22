"""Tests for agent tool path-traversal safety guards."""
from __future__ import annotations

import pytest
from pathlib import Path


@pytest.fixture
def workspace(tmp_path):
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "PRD.md").write_text("# PRD", encoding="utf-8")
    return tmp_path


def _fs_write(workspace: Path, rel_path: str, content: str) -> str:
    """Mirrors the safety logic in apps/agents/tools.py fs_write."""
    target = (workspace / rel_path).resolve()
    if not target.is_relative_to(workspace.resolve()):
        raise PermissionError(f"Path {rel_path!r} escapes workspace")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return str(target)


def _fs_read(workspace: Path, rel_path: str) -> str:
    """Mirrors the safety logic in apps/agents/tools.py fs_read."""
    target = (workspace / rel_path).resolve()
    if not target.is_relative_to(workspace.resolve()):
        raise PermissionError(f"Path {rel_path!r} escapes workspace")
    return target.read_text(encoding="utf-8")


class TestPathTraversal:
    def test_write_inside_workspace_ok(self, workspace):
        _fs_write(workspace, "design/mockup.html", "<html/>")
        assert (workspace / "design" / "mockup.html").exists()

    def test_write_traversal_blocked(self, workspace):
        with pytest.raises(PermissionError):
            _fs_write(workspace, "../../../etc/passwd", "evil")

    def test_write_absolute_path_blocked(self, workspace):
        with pytest.raises(PermissionError):
            _fs_write(workspace, "/etc/passwd", "evil")

    def test_read_inside_workspace_ok(self, workspace):
        content = _fs_read(workspace, "docs/PRD.md")
        assert content == "# PRD"

    def test_read_traversal_blocked(self, workspace):
        with pytest.raises(PermissionError):
            _fs_read(workspace, "../../../etc/passwd")

    def test_write_nested_dirs_created(self, workspace):
        _fs_write(workspace, "apps/web/src/index.tsx", "export {}")
        assert (workspace / "apps" / "web" / "src" / "index.tsx").exists()

    def test_dotdot_in_middle_of_path_blocked(self, workspace):
        with pytest.raises(PermissionError):
            _fs_write(workspace, "docs/../../../etc/evil", "evil")
