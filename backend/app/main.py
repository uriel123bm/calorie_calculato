"""FastAPI application entry point."""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sentry_sdk

from app.api.routes import ingredients as ingredients_routes
from app.api.routes import recipes as recipes_routes
from app.api.routes import auth as auth_routes
from app.api.routes import sync as sync_routes
from app.api.routes import push as push_routes
from app.core.config import settings
from app.db.database import init_db


logging.basicConfig(level=logging.INFO)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )


def create_app() -> FastAPI:
    from contextlib import asynccontextmanager  # noqa: E402 (local import ok here)

    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        if os.getenv("VERCEL") and not os.getenv("DATABASE_URL", "").strip():
            logging.warning(
                "DATABASE_URL is not set — refresh sessions and accounts may not persist "
                "across serverless instances. Use PostgreSQL (Neon/Supabase) in production."
            )
        init_db()
        logging.info("Database initialised.")
        yield

    app = FastAPI(
        title="Recipe Calorie Calculator",
        version="0.2.0",
        description="מחשבון קלוריות למתכונים — backend",
        lifespan=lifespan,
    )

    if not settings.cors_origins:
        raise RuntimeError("CORS_ORIGINS must contain at least one explicit origin")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ingredients_routes.router)
    app.include_router(recipes_routes.router)
    app.include_router(auth_routes.router)
    app.include_router(sync_routes.router)
    app.include_router(push_routes.router)

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {"status": "ok", "message": "Calorie Calculator API is running", "docs": "/docs"}

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
