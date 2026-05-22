from rest_framework import serializers

from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    workspace_path = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "idea",
            "target_platforms",
            "workspace_path",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "workspace_path")

    def get_workspace_path(self, obj) -> str:
        return str(obj.workspace_path)
