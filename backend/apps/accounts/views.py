from __future__ import annotations

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    PreferencesSerializer,
    RegisterSerializer,
    SecretsSerializer,
    UserSerializer,
    tokens_for,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(
            {"user": UserSerializer(user).data, "tokens": tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({"detail": "Invalid credentials"}, status=401)
        return Response(
            {"user": UserSerializer(user).data, "tokens": tokens_for(user)}
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class SecretsView(APIView):
    """Set the user's Anthropic key / GitHub PAT (write-only)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = SecretsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = request.user
        if "anthropic_api_key" in ser.validated_data:
            u.anthropic_api_key = ser.validated_data["anthropic_api_key"]
        if "github_pat" in ser.validated_data:
            u.github_pat = ser.validated_data["github_pat"]
        u.save(update_fields=["anthropic_api_key", "github_pat"])
        return Response(UserSerializer(u).data)


class PreferencesView(APIView):
    """Update approval-mode preferences."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = PreferencesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = request.user
        updated = []
        if "default_approval_mode" in ser.validated_data:
            u.default_approval_mode = ser.validated_data["default_approval_mode"]
            updated.append("default_approval_mode")
        if "per_role_approval" in ser.validated_data:
            u.per_role_approval = ser.validated_data["per_role_approval"]
            updated.append("per_role_approval")
        if updated:
            u.save(update_fields=updated)
        return Response(UserSerializer(u).data)
