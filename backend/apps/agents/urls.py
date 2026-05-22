from django.urls import path

from .views import (
    agent_dashboard,
    list_agents,
    list_events,
    run_agent_endpoint,
    team_dashboard,
)

urlpatterns = [
    path("projects/<int:project_id>/agents/", list_agents),
    path("projects/<int:project_id>/agents/<str:role>/run/", run_agent_endpoint),
    path("projects/<int:project_id>/agents/<str:role>/dashboard/", agent_dashboard),
    path("projects/<int:project_id>/teams/", team_dashboard),
    path("projects/<int:project_id>/events/", list_events),
]
