from rest_framework import serializers

from apps.agents.registry import REGISTRY

from .models import Ticket, TicketEvent


class TicketSerializer(serializers.ModelSerializer):
    assignee_display = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id",
            "project",
            "title",
            "description",
            "assignee_role",
            "assignee_display",
            "department",
            "status",
            "priority",
            "parent_ticket",
            "created_by_role",
            "created_by_user",
            "artifact_path",
            "feedback",
            "revision",
            "agent_run",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "assignee_display", "department")

    def get_assignee_display(self, obj) -> str:
        spec = REGISTRY.get(obj.assignee_role)
        return spec.display_name if spec else obj.assignee_role

    def get_department(self, obj) -> str:
        spec = REGISTRY.get(obj.assignee_role)
        return spec.department if spec else ""


class TicketEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketEvent
        fields = (
            "id",
            "ticket",
            "kind",
            "summary",
            "payload",
            "actor_role",
            "actor_user",
            "created_at",
        )


class CreateTicketSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300)
    description = serializers.CharField(allow_blank=True, default="")
    assignee_role = serializers.CharField(max_length=32)
    priority = serializers.ChoiceField(
        choices=["low", "medium", "high", "urgent"], required=False, default="medium"
    )


class RejectTicketSerializer(serializers.Serializer):
    feedback = serializers.CharField(allow_blank=False)


class FeedbackSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300, required=False, allow_blank=True)
    description = serializers.CharField()
    where = serializers.CharField(required=False, allow_blank=True, default="")  # e.g. URL fragment, selector
    severity = serializers.ChoiceField(
        choices=["low", "medium", "high", "urgent"], required=False, default="medium"
    )
