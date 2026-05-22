from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.projects.models import Project

from .models import WorkflowTask
from .serializers import WorkflowTaskSerializer


class WorkflowTaskViewSet(viewsets.ModelViewSet):
    serializer_class = WorkflowTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        project_id = self.kwargs["project_id"]
        get_object_or_404(Project, pk=project_id, owner=self.request.user)
        return WorkflowTask.objects.filter(project_id=project_id)

    def perform_create(self, serializer):
        project = get_object_or_404(
            Project, pk=self.kwargs["project_id"], owner=self.request.user
        )
        serializer.save(project=project)
