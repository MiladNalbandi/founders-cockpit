from __future__ import annotations

from pathlib import Path

from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.projects.models import Project

from .models import Artifact
from .serializers import ArtifactSerializer


def _project(user, pid: int) -> Project:
    return get_object_or_404(Project, pk=pid, owner=user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_artifacts(request, project_id: int):
    project = _project(request.user, project_id)
    qs = Artifact.objects.filter(project=project)
    return Response(ArtifactSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_artifact(request, project_id: int, artifact_id: int):
    project = _project(request.user, project_id)
    art = get_object_or_404(Artifact, pk=artifact_id, project=project)
    return Response(ArtifactSerializer(art).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def artifact_content(request, project_id: int, artifact_id: int):
    project = _project(request.user, project_id)
    art = get_object_or_404(Artifact, pk=artifact_id, project=project)
    path = Path(art.abs_path)
    if not path.exists():
        raise Http404
    text = path.read_text(encoding="utf-8", errors="replace")
    return HttpResponse(text, content_type="text/plain; charset=utf-8")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def artifact_raw(request, project_id: int, artifact_id: int):
    """Serve the raw file (useful for previewing HTML mockups in an iframe)."""
    project = _project(request.user, project_id)
    art = get_object_or_404(Artifact, pk=artifact_id, project=project)
    path = Path(art.abs_path)
    if not path.exists():
        raise Http404
    ctype = "text/html" if path.suffix == ".html" else "text/plain"
    return FileResponse(path.open("rb"), content_type=ctype)


# ----------------- Preview versions (V3.3) -----------------


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_preview_versions(request, project_id: int):
    from .models import PreviewVersion

    project = _project(request.user, project_id)
    rows = PreviewVersion.objects.filter(project=project).only(
        "id", "version", "summary", "author_role", "pipeline_run", "created_at"
    )
    return Response(
        [
            {
                "id": r.id,
                "version": r.version,
                "summary": r.summary,
                "author_role": r.author_role,
                "pipeline_run": r.pipeline_run_id,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def preview_version_content(request, project_id: int, version: int):
    from .models import PreviewVersion

    project = _project(request.user, project_id)
    pv = get_object_or_404(PreviewVersion, project=project, version=version)
    return HttpResponse(pv.html_content, content_type="text/html; charset=utf-8")
