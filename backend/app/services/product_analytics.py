"""Server-side product analytics (PostHog). Disabled when POSTHOG_API_KEY is unset."""

from __future__ import annotations

from posthog import Posthog

from app.core.config import settings

_client: Posthog | None = None


def _get_client() -> Posthog | None:
    global _client
    if not settings.posthog_api_key:
        return None
    if _client is None:
        _client = Posthog(settings.posthog_api_key, host=settings.posthog_host)
    return _client


def capture_user_signed_up(user_id: str, username: str) -> None:
    """Fire once after a new User row is committed. Never raises."""
    ph = _get_client()
    if ph is None:
        return
    try:
        ph.capture(
            distinct_id=user_id,
            event="user_signed_up",
            properties={"username": username},
        )
        ph.flush()
    except Exception:
        pass
