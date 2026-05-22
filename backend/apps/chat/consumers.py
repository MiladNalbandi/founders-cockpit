"""Channels consumer that pushes per-project live events to the Cockpit UI."""
from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.projects.models import Project

log = logging.getLogger(__name__)


class ProjectConsumer(AsyncJsonWebsocketConsumer):
    """One socket per (project, user). Auth via ?token=<jwt> on connect."""

    async def connect(self):
        project_id = int(self.scope["url_route"]["kwargs"]["project_id"])
        token = self._token_from_query()
        user_id = self._user_id_from_token(token)
        if user_id is None:
            await self.close(code=4401)
            return
        if not await self._user_owns_project(user_id, project_id):
            await self.close(code=4403)
            return
        self.project_id = project_id
        self.group = f"project_{project_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self.send_json({"type": "hello", "project_id": project_id})

    async def disconnect(self, code):
        group = getattr(self, "group", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def project_event(self, event):
        """Receive events sent via ``group_send`` and forward to client."""
        await self.send_json(event["data"])

    # ------- helpers -------

    def _token_from_query(self) -> str | None:
        qs = self.scope.get("query_string", b"").decode()
        for pair in qs.split("&"):
            if pair.startswith("token="):
                return pair[len("token=") :]
        return None

    @staticmethod
    def _user_id_from_token(token: str | None) -> int | None:
        if not token:
            return None
        try:
            decoded = AccessToken(token)
            return int(decoded["user_id"])
        except (TokenError, KeyError, ValueError):
            return None

    @staticmethod
    @database_sync_to_async
    def _user_owns_project(user_id: int, project_id: int) -> bool:
        return Project.objects.filter(pk=project_id, owner_id=user_id).exists()
