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
from datetime import datetime, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

# ──────────────────────────────────────────────
# Pydantic schemas
# ──────────────────────────────────────────────

REFRESH_COOKIE = "refresh_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30   # 30 days in seconds


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

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh)

    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="אימייל או סיסמה שגויים",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="החשבון מושבת")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh)

    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserOut.model_validate(current_user)


@router.post("/refresh", response_model=TokenOut)
def refresh_tokens(
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    db: Session = Depends(get_db),
):
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="אין טוקן רענון")
    try:
        user_id = decode_token(refresh_token, "refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="טוקן רענון לא תקין")

    user = _get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="משתמש לא קיים")

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, new_refresh)

    return TokenOut(access_token=new_access, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    _clear_refresh_cookie(response)
