from rest_framework import serializers

from .models import WorkflowTask


class WorkflowTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowTask
        fields = (
            "id",
            "department",
            "title",
            "description",
            "status",
            "assignee",
            "created_at",
            "updated_at",
        )
