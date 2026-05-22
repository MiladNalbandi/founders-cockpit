from __future__ import annotations

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from .crypto import EncryptedTextField


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Email-as-username user with optional encrypted Anthropic key."""

    username = None  # we use email
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200, blank=True)
    anthropic_api_key = EncryptedTextField(blank=True, default="")
    github_pat = EncryptedTextField(blank=True, default="")
    # Default approval mode applied when starting a pipeline. Per-run overrides
    # exist; per-role overrides live in ``per_role_approval``.
    default_approval_mode = models.CharField(max_length=24, default="after_run")
    per_role_approval = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    def __str__(self) -> str:
        return self.email
