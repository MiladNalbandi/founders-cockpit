from django.urls import path

from .views import (
    approve_ticket,
    create_ticket,
    get_ticket,
    list_tickets,
    reject_ticket,
    submit_feedback,
    ticket_events,
)

urlpatterns = [
    path("projects/<int:project_id>/tickets/", list_tickets),
    path("projects/<int:project_id>/tickets/create/", create_ticket),
    path("projects/<int:project_id>/feedback/", submit_feedback),
    path("tickets/<int:ticket_id>/", get_ticket),
    path("tickets/<int:ticket_id>/events/", ticket_events),
    path("tickets/<int:ticket_id>/approve/", approve_ticket),
    path("tickets/<int:ticket_id>/reject/", reject_ticket),
]
