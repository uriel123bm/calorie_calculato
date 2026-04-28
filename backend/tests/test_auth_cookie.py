"""Refresh-cookie path must match how the browser calls auth routes (incl. /_/backend/auth on Vercel)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


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
