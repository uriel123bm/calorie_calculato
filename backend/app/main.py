"""FastAPI application entry point."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sentry_sdk

from app.api.routes import ingredients as ingredients_routes
from app.api.routes import recipes as recipes_routes
from app.api.routes import auth as auth_routes
from app.api.routes import sync as sync_routes
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
    app = FastAPI(
        title="Recipe Calorie Calculator",
        version="0.2.0",
        description="מחשבון קלוריות למתכונים — backend",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ingredients_routes.router)
    app.include_router(recipes_routes.router)
    app.include_router(auth_routes.router)
    app.include_router(sync_routes.router)

    from contextlib import asynccontextmanager  # noqa: E402 (local import ok here)

    @asynccontextmanager
    async def lifespan(a):  # type: ignore[override]
        init_db()
        logging.info("Database initialised.")
        yield

    app.router.lifespan_context = lifespan

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {"status": "ok", "message": "Calorie Calculator API is running", "docs": "/docs"}

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
