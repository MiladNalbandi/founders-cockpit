"""Shared test configuration and fixtures."""
from __future__ import annotations

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def mock_celery_dispatch():
    """Prevent tests from actually dispatching Celery tasks.

    _dispatch() in the orchestrator sets step.status = RUNNING before calling
    .delay(), so mocking .delay() to a no-op is enough for all state-machine tests.
    """
    with patch("apps.agents.tasks.run_pipeline_step_task.delay") as mock:
        mock.return_value = None
        yield mock


@pytest.fixture(autouse=True)
def mock_ws_broadcast():
    """Prevent tests from trying to connect to Redis for WS broadcasting."""
    with patch("apps.agents.broadcast.push") as mock:
        mock.return_value = None
        yield mock
