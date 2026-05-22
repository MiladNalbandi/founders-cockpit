from rest_framework import serializers

from .models import Agent, AgentEvent, AgentRun
from .registry import role_spec


class AgentSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    parent_role = serializers.SerializerMethodField()
    full_implementation = serializers.SerializerMethodField()

    class Meta:
        model = Agent
        fields = (
            "id",
            "role",
            "display_name",
            "department",
            "parent_role",
            "status",
            "current_task",
            "last_activity_at",
            "full_implementation",
        )

    def get_display_name(self, obj) -> str:
        return role_spec(obj.role).display_name

    def get_department(self, obj) -> str:
        return role_spec(obj.role).department

    def get_parent_role(self, obj) -> str | None:
        return role_spec(obj.role).parent_role

    def get_full_implementation(self, obj) -> bool:
        return role_spec(obj.role).full_implementation


class AgentRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRun
        fields = (
            "id",
            "agent",
            "input",
            "output",
            "error",
            "started_at",
            "finished_at",
            "input_tokens",
            "output_tokens",
        )


class AgentEventSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="agent.role", read_only=True)

    class Meta:
        model = AgentEvent
        fields = ("id", "agent", "role", "kind", "summary", "payload", "created_at")
