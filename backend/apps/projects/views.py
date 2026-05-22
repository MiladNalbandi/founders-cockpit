from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """Multi-idea dashboard summary: each project + latest pipeline + ticket counts."""
    from apps.pipelines.models import PipelineRun, PipelineStepStatus
    from apps.tickets.models import Ticket, TicketStatus

    rows = []
    for p in Project.objects.filter(owner=request.user).order_by("-created_at"):
        latest_run = (
            PipelineRun.objects.filter(pipeline__project=p)
            .order_by("-started_at")
            .first()
        )
        if latest_run:
            awaiting_steps = latest_run.steps.filter(
                status=PipelineStepStatus.AWAITING
            ).count()
            run_info = {
                "id": latest_run.id,
                "status": latest_run.status,
                "started_at": latest_run.started_at.isoformat(),
                "awaiting_steps": awaiting_steps,
            }
        else:
            run_info = None

        ticket_qs = Ticket.objects.filter(project=p)
        in_review = ticket_qs.filter(status=TicketStatus.IN_REVIEW).count()
        in_progress = ticket_qs.filter(status=TicketStatus.IN_PROGRESS).count()
        done = ticket_qs.filter(status=TicketStatus.DONE).count()

        rows.append(
            {
                "project": ProjectSerializer(p).data,
                "latest_run": run_info,
                "tickets": {
                    "in_review": in_review,
                    "in_progress": in_progress,
                    "done": done,
                    "total": ticket_qs.count(),
                },
                "last_activity_at": p.updated_at.isoformat(),
            }
        )
    return Response(rows)
