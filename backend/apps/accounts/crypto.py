"""Tiny Fernet-based field encryption for secrets at rest."""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _cipher() -> Fernet:
    key = settings.FERNET_KEY
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _cipher().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _cipher().decrypt(token.encode()).decode()
    except InvalidToken:
        return ""


class EncryptedTextField(models.TextField):
    """Stores plaintext encrypted; transparent for callers."""

    description = "Fernet-encrypted text"

    def from_db_value(self, value, expression, connection):  # noqa: D401
        if value is None:
            return value
        return decrypt(value)

    def to_python(self, value):  # noqa: D401
        return value

    def get_prep_value(self, value):  # noqa: D401
        if value is None or value == "":
            return value
        return encrypt(value)
