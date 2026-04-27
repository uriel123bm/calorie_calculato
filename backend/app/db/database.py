"""
SQLAlchemy database setup.
- Development : SQLite (auto-created next to the backend folder)
- Production  : PostgreSQL via DATABASE_URL environment variable
"""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if _DATABASE_URL:
    # Render / Heroku give "postgres://..." — SQLAlchemy needs "postgresql+psycopg2://"
    if _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif _DATABASE_URL.startswith("postgresql://") and "+psycopg2" not in _DATABASE_URL:
        _DATABASE_URL = _DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(_DATABASE_URL, pool_pre_ping=True)
else:
    # Local SQLite fallback
    _DB_PATH = Path(__file__).parent.parent.parent / "data" / "app.db"
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{_DB_PATH}",
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.db import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
