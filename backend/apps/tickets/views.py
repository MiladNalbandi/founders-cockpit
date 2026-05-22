from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.projects.models import Project

from . import orchestrator
from .models import Ticket, TicketEvent
from .serializers import (
    CreateTicketSerializer,
    FeedbackSerializer,
    RejectTicketSerializer,
    TicketEventSerializer,
    TicketSerializer,
)


def _project(user, pid: int):
    return get_object_or_404(Project, pk=pid, owner=user)


def _ticket(user, tid: int) -> Ticket:
    ticket = get_object_or_404(Ticket.objects.select_related("project"), pk=tid)
    if ticket.project.owner_id != user.id:
        from django.http import Http404
        raise Http404
    return ticket


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_tickets(request, project_id: int):
    project = _project(request.user, project_id)
    qs = project.tickets.all()
    role = request.query_params.get("assignee_role")
    if role:
        qs = qs.filter(assignee_role=role)
    st = request.query_params.get("status")
    if st:
        qs = qs.filter(status=st)
    return Response(TicketSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_ticket(request, project_id: int):
    project = _project(request.user, project_id)
    ser = CreateTicketSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ticket = orchestrator.create_ticket(
        project=project,
        title=ser.validated_data["title"],
        description=ser.validated_data["description"],
        assignee_role=ser.validated_data["assignee_role"],
        priority=ser.validated_data.get("priority", "medium"),
        created_by_user=request.user,
    )
    return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_ticket(request, ticket_id: int):
    ticket = _ticket(request.user, ticket_id)
    return Response(TicketSerializer(ticket).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ticket_events(request, ticket_id: int):
    ticket = _ticket(request.user, ticket_id)
    qs = ticket.events.all()
    return Response(TicketEventSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_ticket(request, ticket_id: int):
    ticket = _ticket(request.user, ticket_id)
    ticket = orchestrator.approve(ticket.id, actor_user=request.user)
    return Response({"ok": True, "status": ticket.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_ticket(request, ticket_id: int):
    ticket = _ticket(request.user, ticket_id)
    ser = RejectTicketSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    revision = orchestrator.reject(ticket.id, ser.validated_data["feedback"], actor_user=request.user)
    return Response({"ok": True, "new_ticket_id": revision.id, "new_revision": revision.revision})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_feedback(request, project_id: int):
    """User-reported bug or feature request from the Preview tab.

    Creates a Ticket assigned to the Engineering Lead, who will triage it
    into sub-tickets for frontend/backend/QA.
    """
    project = _project(request.user, project_id)
    ser = FeedbackSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    where = ser.validated_data.get("where") or ""
    body = ser.validated_data["description"]
    if where:
        body = f"Reported on: {where}\n\n{body}"
    title = (ser.validated_data.get("title") or "")[:300] or body[:120]
    ticket = orchestrator.create_ticket(
        project=project,
        title=title,
        description=body,
        assignee_role="engineer",  # Eng Lead triages
        priority=ser.validated_data.get("severity", "medium"),
        created_by_role="founder",
        created_by_user=request.user,
    )
    return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)
