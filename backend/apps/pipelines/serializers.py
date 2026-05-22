from __future__ import annotations

from rest_framework import serializers

from apps.agents.registry import role_spec

from .models import Approval, Pipeline, PipelineRun, PipelineStep


class PipelineStepSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    depends_on = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    previous_revision = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PipelineStep
        fields = (
            "id",
            "run",
            "role",
            "display_name",
            "department",
            "status",
            "revision",
            "feedback",
            "artifact_path",
            "depends_on",
            "previous_revision",
            "agent_run",
            "created_at",
            "started_at",
            "finished_at",
        )

    def get_display_name(self, obj) -> str:
        try:
            return role_spec(obj.role).display_name
        except KeyError:
            return obj.role

    def get_department(self, obj) -> str:
        try:
            return role_spec(obj.role).department
        except KeyError:
            return ""


class PipelineRunSerializer(serializers.ModelSerializer):
    steps = PipelineStepSerializer(many=True, read_only=True)

    class Meta:
        model = PipelineRun
        fields = (
            "id",
            "pipeline",
            "approval_mode",
            "description",
            "status",
            "started_at",
            "finished_at",
            "steps",
        )


class PipelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pipeline
        fields = ("id", "name", "description", "template_data", "created_at")


class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Approval
        fields = ("id", "step", "action", "comment", "edited_content", "created_at")


class StartPipelineSerializer(serializers.Serializer):
    template = serializers.JSONField(required=False)
    approval_mode = serializers.ChoiceField(
        required=False,
        choices=["after_run", "milestone", "every_tool_call", "per_role", "skip"],
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    cancel_running = serializers.BooleanField(required=False, default=False)


class RejectSerializer(serializers.Serializer):
    feedback = serializers.CharField(allow_blank=False)


class EditSerializer(serializers.Serializer):
    content = serializers.CharField(allow_blank=False)
