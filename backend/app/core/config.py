"""Application configuration loaded from environment variables / .env."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    openai_model: str
    cors_origins: list[str]
    data_dir: Path
    # JWT
    jwt_secret: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    # Refresh-token cookie security (cross-origin needs Secure + SameSite=None)
    cookie_secure: bool
    cookie_samesite: str
    # Must prefix-match browser URL paths. Use "/" when API is mounted under /_/backend/* (Vercel).
    auth_cookie_path: str
    sentry_dsn: str
    sentry_environment: str
    sentry_traces_sample_rate: float
    # PostHog (optional) — same project as frontend VITE_POSTHOG_KEY
    posthog_api_key: str
    posthog_host: str


def _parse_origins(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _parse_bool(raw: str, default: bool = False) -> bool:
    return raw.strip().lower() in {"1", "true", "yes", "on"} if raw else default


def _parse_samesite(raw: str) -> str:
    v = (raw or "").strip().lower()
    return v if v in {"lax", "strict", "none"} else "lax"


def get_settings() -> Settings:
    # Generate a random fallback secret for dev; MUST be set in production via .env
    import secrets as _s
    default_secret = _s.token_hex(32)
    environment = (os.getenv("SENTRY_ENVIRONMENT", "development").strip() or "development").lower()
    default_cookie_secure = bool(os.getenv("VERCEL")) or environment == "production"
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        cors_origins=_parse_origins(
            os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            )
        ),
        data_dir=_BACKEND_ROOT / "app" / "data",
        jwt_secret=os.getenv("JWT_SECRET", default_secret).strip(),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256").strip(),
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200")),
        refresh_token_expire_days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30")),
        cookie_secure=_parse_bool(os.getenv("COOKIE_SECURE", ""), default=default_cookie_secure),
        cookie_samesite=_parse_samesite(os.getenv("COOKIE_SAMESITE", "lax")),
        auth_cookie_path=(os.getenv("AUTH_COOKIE_PATH") or "/").strip() or "/",
        sentry_dsn=os.getenv("SENTRY_DSN", "").strip(),
        sentry_environment=environment,
        sentry_traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
        posthog_api_key=os.getenv("POSTHOG_API_KEY", "").strip(),
        posthog_host=(
            os.getenv("POSTHOG_HOST", "").strip() or "https://eu.i.posthog.com"
        ),
    )


settings = get_settings()
