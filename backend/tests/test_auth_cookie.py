"""Refresh-cookie path must match how the browser calls auth routes (incl. /_/backend/auth on Vercel)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.database import SessionLocal
from app.db.models import RefreshToken


def test_register_sets_refresh_cookie_path_for_prefixed_api() -> None:
    email = f"cookie_{uuid.uuid4().hex[:12]}@example.com"
    with TestClient(app) as client:
        r = client.post(
            "/auth/register",
            json={"email": email, "username": f"u{uuid.uuid4().hex[:8]}", "password": "password12"},
        )
    assert r.status_code == 201
    set_cookie = r.headers.get("set-cookie") or ""
    assert "refresh_token=" in set_cookie
    assert "path=/" in set_cookie.lower()
    body = r.json()
    assert body.get("refresh_token")
    assert body.get("access_token")


def test_refresh_accepts_body_token_without_csrf_when_cookies_cleared() -> None:
    email = f"body_{uuid.uuid4().hex[:12]}@example.com"
    with TestClient(app) as client:
        r = client.post(
            "/auth/register",
            json={"email": email, "username": f"u{uuid.uuid4().hex[:8]}", "password": "password12"},
        )
        assert r.status_code == 201
        refresh_from_body = r.json()["refresh_token"]
        assert refresh_from_body

        client.cookies.clear()
        refreshed = client.post("/auth/refresh", json={"refresh_token": refresh_from_body})
        assert refreshed.status_code == 200
        assert refreshed.json().get("access_token")
        assert refreshed.json().get("refresh_token")


def test_refresh_token_rotates_and_revokes_previous_session() -> None:
    email = f"rotate_{uuid.uuid4().hex[:12]}@example.com"
    with TestClient(app) as client:
        r = client.post(
            "/auth/register",
            json={"email": email, "username": f"u{uuid.uuid4().hex[:8]}", "password": "password12"},
        )
        assert r.status_code == 201

        first_refresh_cookie = client.cookies.get("refresh_token")
        csrf_cookie = client.cookies.get("csrf_token")
        assert first_refresh_cookie
        assert csrf_cookie

        refreshed = client.post("/auth/refresh", headers={"X-CSRF-Token": csrf_cookie})
        assert refreshed.status_code == 200
        second_refresh_cookie = client.cookies.get("refresh_token")
        assert second_refresh_cookie
        assert second_refresh_cookie != first_refresh_cookie

        # Replay with the old token should fail after rotation.
        client.cookies.set("refresh_token", first_refresh_cookie)
        replay = client.post(
            "/auth/refresh",
            headers={"X-CSRF-Token": client.cookies.get("csrf_token") or ""},
        )
        assert replay.status_code == 401


def test_logout_revokes_refresh_session() -> None:
    email = f"logout_{uuid.uuid4().hex[:12]}@example.com"
    with TestClient(app) as client:
        r = client.post(
            "/auth/register",
            json={"email": email, "username": f"u{uuid.uuid4().hex[:8]}", "password": "password12"},
        )
        assert r.status_code == 201
        refresh_cookie = client.cookies.get("refresh_token")
        csrf_cookie = client.cookies.get("csrf_token")
        assert refresh_cookie and csrf_cookie

        out = client.post("/auth/logout", headers={"X-CSRF-Token": csrf_cookie})
        assert out.status_code == 204

        # refresh after logout must fail
        fail = client.post("/auth/refresh", headers={"X-CSRF-Token": csrf_cookie})
        assert fail.status_code == 401

    db: Session = SessionLocal()
    try:
        rows = db.query(RefreshToken).all()
        assert any(r.revoked_at is not None for r in rows)
    finally:
        db.close()
