from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.projects.models import Project

from .models import ChatMessage, ChatThread
from .serializers import ChatThreadSerializer
from .tasks import process_buddy_message


def _project(user, pid: int) -> Project:
    return get_object_or_404(Project, pk=pid, owner=user)


def _get_or_create_buddy_thread(project) -> ChatThread:
    thread, _ = ChatThread.objects.get_or_create(
        project=project,
        kind="buddy",
        defaults={"title": "Buddy"},
    )
    return thread


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def buddy_thread(request, project_id: int):
    project = _project(request.user, project_id)
    thread = _get_or_create_buddy_thread(project)
    return Response(ChatThreadSerializer(thread).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_buddy_message(request, project_id: int):
    project = _project(request.user, project_id)
    text = (request.data.get("content") or "").strip()
    if not text:
        return Response({"detail": "content required"}, status=400)
    thread = _get_or_create_buddy_thread(project)
    user_msg = ChatMessage.objects.create(thread=thread, role="user", content=text)
    process_buddy_message.delay(thread.id, user_msg.id)
    return Response(
        {"thread_id": thread.id, "user_message_id": user_msg.id},
        status=status.HTTP_202_ACCEPTED,
    )
