from django.urls import path

from .views import (
    artifact_content,
    artifact_raw,
    get_artifact,
    list_artifacts,
    list_preview_versions,
    preview_version_content,
)

urlpatterns = [
    path("projects/<int:project_id>/artifacts/", list_artifacts),
    path("projects/<int:project_id>/artifacts/<int:artifact_id>/", get_artifact),
    path("projects/<int:project_id>/artifacts/<int:artifact_id>/content/", artifact_content),
    path("projects/<int:project_id>/artifacts/<int:artifact_id>/raw/", artifact_raw),
    path("projects/<int:project_id>/preview-versions/", list_preview_versions),
    path(
        "projects/<int:project_id>/preview-versions/<int:version>/content/",
        preview_version_content,
    ),
]
