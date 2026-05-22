"""Ticket lifecycle — small state machine + Celery dispatcher.

Flow::

    created ──(assignee set)──> triaged ──(worker picks up)──> in_progress
                                                                   │
                                                                   ▼
                                                              in_review
                                                                   │
                                                ┌──────────────────┼──────────────────┐
                                                ▼                  ▼                  ▼
                                              done             rejected         (edit-and-approve = done)
                                                              (spawns child)
"""
from __future__ import annotations

import logging
from typing import Iterable

from django.db import transaction
from django.utils import timezone

from apps.agents.broadcast import push

from .models import Ticket, TicketEvent, TicketStatus

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@transaction.atomic
def create_ticket(
    project,
    title: str,
    description: str,
    assignee_role: str,
    *,
    created_by_role: str = "",
    created_by_user=None,
    parent_ticket: Ticket | None = None,
    priority: str = "medium",
    auto_dispatch: bool = True,
) -> Ticket:
    ticket = Ticket.objects.create(
        project=project,
        title=title[:300],
        description=description,
        assignee_role=assignee_role,
        status=TicketStatus.TRIAGED if assignee_role else TicketStatus.CREATED,
        priority=priority,
        parent_ticket=parent_ticket,
        created_by_role=created_by_role,
        created_by_user=created_by_user,
    )
    _log_event(ticket, "created", f"ticket created by {created_by_role or 'founder'}")
    _broadcast(ticket)
    if auto_dispatch and ticket.status == TicketStatus.TRIAGED:
        _dispatch(ticket)
    return ticket


def import_tickets_from_json(project, eng_lead_run_id: int | None, tickets_json: dict) -> list[Ticket]:
    """Parse the Eng Lead's ``engineering/tickets.json`` and create tickets."""
    created: list[Ticket] = []
    for entry in tickets_json.get("tickets", [])[:20]:
        title = (entry.get("title") or "").strip()
        if not title:
            continue
        t = create_ticket(
            project=project,
            title=title,
            description=entry.get("description", ""),
            assignee_role=entry.get("assignee_role", ""),
            created_by_role="engineer",
            priority=(entry.get("priority") or "medium").lower(),
            auto_dispatch=True,
        )
        created.append(t)
    return created


@transaction.atomic
def complete_in_progress(ticket_id: int, agent_run_id: int, artifact_path: str | None) -> None:
    """Called by the worker when the assigned agent finishes the ticket."""
    ticket = Ticket.objects.select_for_update().get(pk=ticket_id)
    ticket.agent_run_id = agent_run_id
    ticket.status = TicketStatus.IN_REVIEW
    ticket.artifact_path = artifact_path or ticket.artifact_path
    ticket.save()
    _log_event(
        ticket,
        "status_changed",
        f"finished — awaiting review",
        payload={"to": "in_review"},
    )
    _broadcast(ticket)


@transaction.atomic
def fail_in_progress(ticket_id: int, error: str) -> None:
    ticket = Ticket.objects.select_for_update().get(pk=ticket_id)
    ticket.status = TicketStatus.REJECTED
    ticket.feedback = error[:1000]
    ticket.save(update_fields=["status", "feedback"])
    _log_event(ticket, "status_changed", f"failed: {error[:120]}", payload={"to": "rejected"})
    _broadcast(ticket)


@transaction.atomic
def approve(ticket_id: int, actor_user=None) -> Ticket:
    ticket = Ticket.objects.select_for_update().get(pk=ticket_id)
    if ticket.status not in (TicketStatus.IN_REVIEW, TicketStatus.TRIAGED):
        return ticket
    ticket.status = TicketStatus.DONE
    ticket.save(update_fields=["status"])
    _log_event(
        ticket,
        "status_changed",
        "approved by founder",
        payload={"to": "done"},
        actor_user=actor_user,
    )
    _broadcast(ticket)
    return ticket


@transaction.atomic
def reject(ticket_id: int, feedback: str, actor_user=None) -> Ticket:
    ticket = Ticket.objects.select_for_update().get(pk=ticket_id)
    if ticket.status != TicketStatus.IN_REVIEW:
        return ticket
    ticket.status = TicketStatus.REJECTED
    ticket.save(update_fields=["status"])
    _log_event(
        ticket,
        "status_changed",
        "rejected with feedback",
        payload={"to": "rejected", "feedback": feedback[:1000]},
        actor_user=actor_user,
    )

    revision = Ticket.objects.create(
        project=ticket.project,
        title=ticket.title,
        description=ticket.description,
        assignee_role=ticket.assignee_role,
        status=TicketStatus.TRIAGED,
        priority=ticket.priority,
        parent_ticket=ticket,
        created_by_role=ticket.created_by_role,
        created_by_user=ticket.created_by_user,
        feedback=feedback,
        revision=ticket.revision + 1,
    )
    _log_event(revision, "created", f"revision {revision.revision} after reject", actor_user=actor_user)
    _broadcast(ticket)
    _broadcast(revision)
    _dispatch(revision)
    return revision


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------


def _dispatch(ticket: Ticket) -> None:
    """Mark in_progress and hand off to Celery."""
    from apps.agents.tasks import run_ticket_task

    ticket.status = TicketStatus.IN_PROGRESS
    ticket.save(update_fields=["status"])
    _log_event(ticket, "status_changed", "agent picked up ticket", payload={"to": "in_progress"})
    _broadcast(ticket)
    run_ticket_task.delay(ticket.id)


def _log_event(
    ticket: Ticket,
    kind: str,
    summary: str,
    payload: dict | None = None,
    actor_user=None,
) -> TicketEvent:
    event = TicketEvent.objects.create(
        ticket=ticket,
        kind=kind,
        summary=summary[:400],
        payload=payload or {},
        actor_role=ticket.assignee_role if kind == "status_changed" else "",
        actor_user=actor_user,
    )
    push(
        ticket.project_id,
        {
            "type": "ticket_event",
            "ticket_id": ticket.id,
            "kind": kind,
            "summary": event.summary,
            "payload": event.payload,
            "created_at": event.created_at.isoformat(),
        },
    )
    return event


def _broadcast(ticket: Ticket) -> None:
    push(
        ticket.project_id,
        {
            "type": "ticket",
            "ticket_id": ticket.id,
            "title": ticket.title,
            "assignee_role": ticket.assignee_role,
            "status": ticket.status,
            "priority": ticket.priority,
            "revision": ticket.revision,
            "artifact_path": ticket.artifact_path,
            "parent_ticket_id": ticket.parent_ticket_id,
        },
    )
