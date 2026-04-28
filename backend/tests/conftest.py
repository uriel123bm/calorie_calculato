"""Ensure DB schema exists before API tests — CI clones have no pre-built backend/data/app.db."""

import pytest

from app.db.database import init_db


@pytest.fixture(scope="session", autouse=True)
def _ensure_db_schema() -> None:
    init_db()
