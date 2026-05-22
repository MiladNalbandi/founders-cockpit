from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.projects.models import Project

from . import orchestrator
from .models import Approval, PipelineRun, PipelineStep
from .serializers import (
    ApprovalSerializer,
    EditSerializer,
    PipelineRunSerializer,
    RejectSerializer,
    StartPipelineSerializer,
)


def _project(user, pid: int):
    return get_object_or_404(Project, pk=pid, owner=user)


def _step_for(user, step_id: int) -> PipelineStep:
    step = get_object_or_404(
        PipelineStep.objects.select_related("run__pipeline__project"), pk=step_id
    )
    if step.run.pipeline.project.owner_id != user.id:
        from django.http import Http404

        raise Http404
    return step


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start(request, project_id: int):
    project = _project(request.user, project_id)
    ser = StartPipelineSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    try:
        run = orchestrator.start_pipeline(
            project=project,
            initiator=request.user,
            template=ser.validated_data.get("template"),
            approval_mode=ser.validated_data.get("approval_mode"),
            description=ser.validated_data.get("description", ""),
            cancel_running=ser.validated_data.get("cancel_running", False),
        )
    except orchestrator.PipelineConflict as exc:
        return Response(
            {
                "detail": "A pipeline run is already active for this project.",
                "active_run_id": exc.active_run_id,
                "code": "pipeline_active",
            },
            status=status.HTTP_409_CONFLICT,
        )
    return Response(PipelineRunSerializer(run).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_runs(request, project_id: int):
    project = _project(request.user, project_id)
    qs = PipelineRun.objects.filter(pipeline__project=project).order_by("-started_at")
    return Response(PipelineRunSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_run(request, project_id: int, run_id: int):
    project = _project(request.user, project_id)
    run = get_object_or_404(PipelineRun, pk=run_id, pipeline__project=project)
    return Response(PipelineRunSerializer(run).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_step(request, step_id: int):
    step = _step_for(request.user, step_id)
    step = orchestrator.approve(step.id)
    Approval.objects.create(step=step, actor=request.user, action="approve")
    return Response({"ok": True, "step_id": step.id, "status": step.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reject_step(request, step_id: int):
    step = _step_for(request.user, step_id)
    ser = RejectSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    new_step = orchestrator.reject(step.id, ser.validated_data["feedback"])
    Approval.objects.create(
        step=step, actor=request.user, action="reject", comment=ser.validated_data["feedback"]
    )
    return Response({"ok": True, "new_step_id": new_step.id, "new_revision": new_step.revision})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_run(request, run_id: int):
    run = get_object_or_404(
        PipelineRun.objects.select_related("pipeline__project"), pk=run_id
    )
    if run.pipeline.project.owner_id != request.user.id:
        from django.http import Http404

        raise Http404
    run = orchestrator.cancel_run(run.id)
    return Response(PipelineRunSerializer(run).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def retry_step(request, step_id: int):
    """Retry a failed step (e.g. after a timeout) without restarting the whole pipeline."""
    step = _step_for(request.user, step_id)
    from .models import PipelineStepStatus
    if step.status != PipelineStepStatus.FAILED:
        return Response({"ok": False, "error": "step is not in failed state"}, status=400)
    new_step = orchestrator.retry_step(step.id)
    return Response({"ok": True, "step_id": new_step.id, "status": new_step.status})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def edit_step(request, step_id: int):
    step = _step_for(request.user, step_id)
    ser = EditSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    step = orchestrator.edit_and_approve(step.id, ser.validated_data["content"])
    Approval.objects.create(
        step=step, actor=request.user, action="edit", edited_content=ser.validated_data["content"][:6000]
    )
    return Response({"ok": True, "step_id": step.id, "status": step.status})
