"""
Authentication endpoints.

POST /auth/register  — create new account
POST /auth/login     — get access + refresh tokens
GET  /auth/me        — return current user info
POST /auth/refresh   — exchange refresh cookie for new access token
POST /auth/logout    — clear the refresh cookie
"""
from __future__ import annotations

import re
import secrets
import time
import uuid
from datetime import timedelta
from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decode_token_payload,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.db.models import RefreshToken, User
from app.services.product_analytics import capture_user_signed_up

router = APIRouter(prefix="/auth", tags=["auth"])

# ──────────────────────────────────────────────
# Pydantic schemas
# ──────────────────────────────────────────────

REFRESH_COOKIE = "refresh_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30   # 30 days in seconds
MAX_ATTEMPTS = 8
WINDOW_SECONDS = 15 * 60
_rate_attempts: dict[str, list[float]] = {}


class RegisterIn(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("שם משתמש חייב להכיל לפחות 2 תווים")
        if len(v) > 32:
            raise ValueError("שם משתמש ארוך מדי (מקסימום 32 תווים)")
        if not re.match(r"^[A-Za-z0-9_\u0590-\u05FF ]+$", v):
            raise ValueError("שם משתמש מכיל תווים לא חוקיים")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("סיסמה חייבת להכיל לפחות 8 תווים")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _set_refresh_cookie(response: Response, token: str) -> None:
    # path must match browser URL prefixes. Dev (Vite proxy) uses /auth/*; Vercel uses /_/backend/auth/*.
    # Default "/" is correct for prefixed APIs; override with AUTH_COOKIE_PATH if needed.
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=COOKIE_MAX_AGE,
        path=settings.auth_cookie_path,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=settings.auth_cookie_path,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


def _get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def _get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_expired(ts: datetime) -> bool:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts <= _utcnow()


def _create_refresh_session(db: Session, user_id: str) -> tuple[str, str]:
    jti = uuid.uuid4().hex
    refresh = create_refresh_token(user_id, jti)
    expires_at = _utcnow() + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user_id,
            jti=jti,
            expires_at=expires_at,
        )
    )
    return refresh, jti


def _revoke_refresh_session(
    db: Session,
    jti: str,
    *,
    reason: str,
    replaced_by_jti: str | None = None,
) -> None:
    row = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if row is None or row.revoked_at is not None:
        return
    row.revoked_at = _utcnow()
    row.revoked_reason = reason
    row.replaced_by_jti = replaced_by_jti


def _origin_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    if origin:
        return origin in settings.cors_origins
    if referer:
        return any(referer.startswith(f"{allowed}/") or referer == allowed for allowed in settings.cors_origins)
    # Non-browser / same-origin requests may not include origin headers.
    return True


def _csrf_cookie_header_match(request: Request, csrf_cookie: str | None) -> bool:
    if not request.headers.get("origin") and not request.headers.get("referer"):
        # Non-browser clients may not send origin headers/cookies.
        return True
    header = request.headers.get("x-csrf-token")
    return bool(csrf_cookie and header and csrf_cookie == header)


def _set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=COOKIE_MAX_AGE,
        path=settings.auth_cookie_path,
    )


def _clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(
        key="csrf_token",
        path=settings.auth_cookie_path,
        secure=settings.cookie_secure,
        httponly=False,
        samesite=settings.cookie_samesite,
    )


def _rate_limit_check(key: str) -> None:
    now = time.time()
    window_start = now - WINDOW_SECONDS
    attempts = [t for t in _rate_attempts.get(key, []) if t >= window_start]
    if len(attempts) >= MAX_ATTEMPTS:
        _rate_attempts[key] = attempts
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="יותר מדי ניסיונות, נסו שוב בעוד כמה דקות",
        )
    attempts.append(now)
    _rate_attempts[key] = attempts
    # Evict fully-expired keys to prevent unbounded memory growth.
    stale = [k for k, v in _rate_attempts.items() if not v or max(v) < window_start]
    for k in stale:
        del _rate_attempts[k]


def _rate_limit_clear(key: str) -> None:
    _rate_attempts.pop(key, None)


# ──────────────────────────────────────────────
# Auth dependency — inject current user from Bearer token
# ──────────────────────────────────────────────

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="לא מחובר")
    try:
        user_id = decode_token(credentials.credentials, "access")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="טוקן לא תקין")
    user = _get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="משתמש לא קיים")
    return user


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    # Basic in-process throttle against burst abuse.
    _rate_limit_check(f"register:{body.email.lower()}")
    email = body.email.lower()

    if _get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="כתובת המייל כבר רשומה במערכת",
        )

    # Check username uniqueness
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="שם המשתמש תפוס — בחרו שם אחר",
        )

    user = User(
        email=email,
        username=body.username,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    capture_user_signed_up(user.id, user.username)

    access = create_access_token(user.id)
    refresh, _ = _create_refresh_session(db, user.id)
    db.commit()
    _set_refresh_cookie(response, refresh)
    _set_csrf_cookie(response, secrets.token_urlsafe(32))
    _rate_limit_clear(f"register:{body.email.lower()}")

    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_key = f"login:{request.client.host if request.client else 'unknown'}:{body.email.lower()}"
    _rate_limit_check(rate_key)
    user = _get_user_by_email(db, body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="אימייל או סיסמה שגויים",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="החשבון מושבת")

    access = create_access_token(user.id)
    refresh, _ = _create_refresh_session(db, user.id)
    db.commit()
    _set_refresh_cookie(response, refresh)
    _set_csrf_cookie(response, secrets.token_urlsafe(32))
    _rate_limit_clear(rate_key)

    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserOut.model_validate(current_user)


@router.post("/refresh", response_model=TokenOut)
def refresh_tokens(
    request: Request,
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    csrf_token: Annotated[str | None, Cookie()] = None,
    db: Session = Depends(get_db),
):
    if not _origin_allowed(request) or not _csrf_cookie_header_match(request, csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="בקשה לא מאומתת")
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="אין טוקן רענון")
    try:
        payload = decode_token_payload(refresh_token, "refresh")
        user_id = str(payload.get("sub") or "")
        jti = str(payload.get("jti") or "")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="טוקן רענון לא תקין")
    if not user_id or not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="טוקן רענון לא תקין")

    user = _get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="משתמש לא קיים")

    session_row = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user.id, RefreshToken.jti == jti)
        .first()
    )
    if session_row is None or session_row.revoked_at is not None or _is_expired(session_row.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="טוקן רענון לא תקין")

    new_refresh, new_jti = _create_refresh_session(db, user.id)
    _revoke_refresh_session(db, jti, reason="rotated", replaced_by_jti=new_jti)

    new_access = create_access_token(user.id)
    db.commit()
    _set_refresh_cookie(response, new_refresh)
    _set_csrf_cookie(response, secrets.token_urlsafe(32))

    return TokenOut(access_token=new_access, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    csrf_token: Annotated[str | None, Cookie()] = None,
    db: Session = Depends(get_db),
):
    if not _origin_allowed(request) or not _csrf_cookie_header_match(request, csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="בקשה לא מאומתת")
    if refresh_token:
        try:
            payload = decode_token_payload(refresh_token, "refresh")
            jti = str(payload.get("jti") or "")
            if jti:
                _revoke_refresh_session(db, jti, reason="logout")
                db.commit()
        except jwt.InvalidTokenError:
            # Cookie might already be stale; still clear client cookies.
            pass
    _clear_refresh_cookie(response)
    _clear_csrf_cookie(response)
