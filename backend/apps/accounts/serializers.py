from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("email", "password", "full_name")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    has_anthropic_key = serializers.SerializerMethodField()
    has_github_pat = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "has_anthropic_key",
            "has_github_pat",
            "default_approval_mode",
            "per_role_approval",
        )

    def get_has_anthropic_key(self, obj) -> bool:
        return bool(obj.anthropic_api_key)

    def get_has_github_pat(self, obj) -> bool:
        return bool(obj.github_pat)


class SecretsSerializer(serializers.Serializer):
    anthropic_api_key = serializers.CharField(required=False, allow_blank=True)
    github_pat = serializers.CharField(required=False, allow_blank=True)


class PreferencesSerializer(serializers.Serializer):
    default_approval_mode = serializers.ChoiceField(
        choices=["after_run", "milestone", "every_tool_call", "per_role", "skip"],
        required=False,
    )
    per_role_approval = serializers.DictField(child=serializers.CharField(), required=False)


def tokens_for(user) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}
