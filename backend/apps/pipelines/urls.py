from django.urls import path

from .views import (
    approve_step,
    cancel_run,
    edit_step,
    get_run,
    list_runs,
    reject_step,
    retry_step,
    start,
)

urlpatterns = [
    path("projects/<int:project_id>/pipelines/start/", start),
    path("projects/<int:project_id>/pipeline-runs/", list_runs),
    path("projects/<int:project_id>/pipeline-runs/<int:run_id>/", get_run),
    path("pipeline-runs/<int:run_id>/cancel/", cancel_run),
    path("pipeline-steps/<int:step_id>/approve/", approve_step),
    path("pipeline-steps/<int:step_id>/reject/", reject_step),
    path("pipeline-steps/<int:step_id>/edit/", edit_step),
    path("pipeline-steps/<int:step_id>/retry/", retry_step),
]
