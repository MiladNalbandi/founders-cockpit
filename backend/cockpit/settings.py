"""Django settings for the Founder's Cockpit backend."""
from __future__ import annotations

import json
import os
import secrets
from datetime import timedelta
from pathlib import Path

from cryptography.fernet import Fernet
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# --- Secret management -------------------------------------------------------
# In production (DEBUG=False): both DJANGO_SECRET_KEY and FERNET_KEY MUST be
# set via env / .env. We refuse to start otherwise.
#
# In development (DEBUG=True): if a key is missing we auto-generate one and
# persist it to backend/.dev_secrets.json (gitignored) so subsequent restarts
# keep the same key — which means existing encrypted data still decrypts.
# This file is NEVER committed and the generated values are unique per checkout.

_DEV_SECRETS_PATH = BASE_DIR / ".dev_secrets.json"


def _load_or_create_dev_secrets() -> dict[str, str]:
    if _DEV_SECRETS_PATH.exists():
        try:
            return json.loads(_DEV_SECRETS_PATH.read_text())
        except (OSError, json.JSONDecodeError):
            pass  # fall through and regenerate
    fresh = {
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "FERNET_KEY": Fernet.generate_key().decode("ascii"),
    }
    _DEV_SECRETS_PATH.write_text(json.dumps(fresh, indent=2))
    try:
        _DEV_SECRETS_PATH.chmod(0o600)
    except OSError:
        pass
    return fresh


def _resolve_secret(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    if DEBUG:
        return _load_or_create_dev_secrets()[name]
    raise RuntimeError(
        f"{name} is not set. Refusing to start in production without it. "
        "Set it in the environment or a .env file. "
        "Generate one with: "
        "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )


SECRET_KEY = _resolve_secret("DJANGO_SECRET_KEY")

# Fernet key used to encrypt per-user Anthropic API keys at rest.
# Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_KEY = _resolve_secret("FERNET_KEY")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "channels",
    "apps.accounts",
    "apps.projects",
    "apps.agents",
    "apps.tasks",
    "apps.artifacts",
    "apps.chat",
    "apps.pipelines",
    "apps.tickets",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "cockpit.urls"
WSGI_APPLICATION = "cockpit.wsgi.application"
ASGI_APPLICATION = "cockpit.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Default to SQLite for zero-setup dev; Postgres in prod.
if os.environ.get("DATABASE_URL"):
    import dj_database_url  # type: ignore  # noqa: F401  # pragma: no cover

    DATABASES = {"default": {}}
elif os.environ.get("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.environ.get("POSTGRES_USER", "cockpit"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "cockpit"),
            "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "dev.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}
# Fallback to in-memory for "just want to try it" mode.
if os.environ.get("CHANNELS_IN_MEMORY") == "1":
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 60 * 30
# Run tasks inline when explicitly requested (handy for first-run smoke test).
CELERY_TASK_ALWAYS_EAGER = os.environ.get("CELERY_EAGER", "0") == "1"
CELERY_TASK_EAGER_PROPAGATES = True

WORKSPACES_ROOT = Path(os.environ.get("WORKSPACES_ROOT", BASE_DIR / "workspaces"))
WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)

# Agent backend selection.
#   "anthropic_api"  → direct Anthropic SDK; requires per-user or env API key (multi-tenant friendly).
#   "claude_sdk"     → claude-agent-sdk; uses the logged-in `claude` CLI on the server,
#                      so requests are billed against your Claude Pro/Max subscription.
AGENT_BACKEND = os.environ.get("AGENT_BACKEND", "anthropic_api")

# Anthropic configuration. Per-user keys take precedence; this is the fallback.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_DEFAULT_MODEL = os.environ.get("ANTHROPIC_DEFAULT_MODEL", "claude-sonnet-4-6")
ANTHROPIC_BUDDY_MODEL = os.environ.get("ANTHROPIC_BUDDY_MODEL", "claude-opus-4-7")

# Optional model overrides when using the Claude Agent SDK.
# Leave empty to use whatever the `claude` CLI defaults to (your subscription's default model).
CLAUDE_SDK_MODEL = os.environ.get("CLAUDE_SDK_MODEL", "")
CLAUDE_SDK_BUDDY_MODEL = os.environ.get("CLAUDE_SDK_BUDDY_MODEL", "")

# Per-run safety caps.
AGENT_RUN_MAX_ITERATIONS = int(os.environ.get("AGENT_RUN_MAX_ITERATIONS", "16"))
AGENT_RUN_MAX_TOKENS_PER_TURN = int(os.environ.get("AGENT_RUN_MAX_TOKENS_PER_TURN", "4096"))
AGENT_RUN_TIMEOUT_SECONDS = int(os.environ.get("AGENT_RUN_TIMEOUT_SECONDS", "300"))

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
