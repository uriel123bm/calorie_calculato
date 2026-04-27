"""
Password hashing (bcrypt) and JWT utilities.
All token logic is centralised here so it's easy to audit.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt
from jwt import InvalidTokenError

from app.core.config import settings


# ──────────────────────────────────────────────
# Password utilities
# ──────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*. Never store the plain text."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored *hashed* value."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ──────────────────────────────────────────────
# JWT utilities
# ──────────────────────────────────────────────

TokenKind = Literal["access", "refresh"]


def _create_token(subject: str, kind: TokenKind, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,          # user id
        "kind": kind,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id,
        "refresh",
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_kind: TokenKind) -> str:
    """
    Decode and validate a JWT.
    Returns the user_id (sub) on success.
    Raises jwt.InvalidTokenError on any failure.
    """
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )
    if payload.get("kind") != expected_kind:
        raise InvalidTokenError("wrong token kind")
    sub = payload.get("sub")
    if not sub:
        raise InvalidTokenError("missing sub claim")
    return str(sub)
