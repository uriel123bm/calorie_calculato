"""
Cross-device user-data sync.

The frontend mirrors a small set of localStorage buckets ("tracker",
"history", "recipes", "settings") into the `user_data` table so users
see the same data on every device they log in from.

GET  /sync         → return all buckets for the current user
PUT  /sync         → upsert any subset of buckets sent by the client
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.db.models import User, UserData

router = APIRouter(prefix="/sync", tags=["sync"])

# Whitelist of bucket keys the API will accept. Anything else is rejected so
# clients can't pollute the table with arbitrary keys.
ALLOWED_KEYS: set[str] = {
    "tracker",
    "history",
    "recipes",
    "meals",
    "settings",
    "products",  # personal products library
    "body",      # body metrics + weight log
    "workouts",  # workouts + weekly planning
}

# Hard cap per blob to keep DB rows small (50 KB is plenty for years of usage).
MAX_BLOB_BYTES = 50_000


def _coerce_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_daily_entry(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    entry_id = value.get("id")
    name = value.get("name")
    if not isinstance(entry_id, str) or not entry_id.strip():
        return None
    if not isinstance(name, str):
        name = "פריט"
    cleaned: dict[str, Any] = {
        "id": entry_id,
        "name": name.strip() or "פריט",
        "calories": max(0.0, _coerce_number(value.get("calories"), 0.0)),
        "protein": max(0.0, _coerce_number(value.get("protein"), 0.0)),
        "carbohydrates": max(0.0, _coerce_number(value.get("carbohydrates"), 0.0)),
        "fat": max(0.0, _coerce_number(value.get("fat"), 0.0)),
        "addedAt": int(_coerce_number(value.get("addedAt"), 0)),
    }
    lines = value.get("lines")
    if isinstance(lines, list):
        clean_lines: list[dict[str, Any]] = []
        for line in lines:
            if not isinstance(line, dict):
                continue
            line_name = line.get("name")
            if not isinstance(line_name, str) or not line_name.strip():
                continue
            clean_lines.append(
                {
                    "name": line_name.strip(),
                    "calories": max(0.0, _coerce_number(line.get("calories"), 0.0)),
                    "protein": max(0.0, _coerce_number(line.get("protein"), 0.0)),
                    "carbohydrates": max(0.0, _coerce_number(line.get("carbohydrates"), 0.0)),
                    "fat": max(0.0, _coerce_number(line.get("fat"), 0.0)),
                    "detail": str(line.get("detail", "")).strip() or None,
                }
            )
        if clean_lines:
            cleaned["lines"] = clean_lines
    return cleaned


def _coerce_tracker(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    date = value.get("date")
    if not isinstance(date, str):
        return None
    entries = value.get("entries")
    clean_entries: list[dict[str, Any]] = []
    if isinstance(entries, list):
        for entry in entries:
            cleaned = _coerce_daily_entry(entry)
            if cleaned:
                clean_entries.append(cleaned)
    return {
        "date": date,
        "targetCalories": max(0, int(_coerce_number(value.get("targetCalories"), 0))),
        "entries": clean_entries,
    }


def _coerce_history(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None
    logs: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict) or not isinstance(item.get("date"), str):
            continue
        entries: list[dict[str, Any]] = []
        if isinstance(item.get("entries"), list):
            for entry in item["entries"]:
                cleaned = _coerce_daily_entry(entry)
                if cleaned:
                    entries.append(cleaned)
        logs.append(
            {
                "date": item["date"],
                "targetCalories": max(0, int(_coerce_number(item.get("targetCalories"), 0))),
                "entries": entries,
            }
        )
    return logs


def _coerce_meals(value: Any) -> list[dict[str, str]] | None:
    if not isinstance(value, list):
        return None
    meals: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        meal_id = item.get("id")
        name = item.get("name")
        if isinstance(meal_id, str) and meal_id.strip() and isinstance(name, str) and name.strip():
            meals.append({"id": meal_id, "name": name.strip()})
    return meals


def _coerce_recipes(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None
    recipes: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        recipe_id = item.get("id")
        name = item.get("name")
        if not isinstance(recipe_id, str) or not recipe_id.strip():
            continue
        if not isinstance(name, str):
            continue
        recipes.append(item)
    return recipes


def _coerce_products(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None
    products: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        product_id = item.get("id")
        name = item.get("name")
        if not isinstance(product_id, str) or not isinstance(name, str):
            continue
        products.append(item)
    return products


def _coerce_body(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    if not all(k in value for k in ("heightCm", "startWeightKg", "currentWeightKg")):
        return None
    cleaned = dict(value)
    log = value.get("log")
    if isinstance(log, list):
        cleaned_log: list[dict[str, Any]] = []
        for entry in log:
            if not isinstance(entry, dict):
                continue
            date = entry.get("date")
            weight = entry.get("weightKg")
            if isinstance(date, str):
                cleaned_log.append(
                    {
                        "date": date,
                        "weightKg": _coerce_number(weight, 0.0),
                        "circumferences": entry.get("circumferences"),
                    }
                )
        cleaned["log"] = cleaned_log
    return cleaned


def _coerce_workouts(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    entries = value.get("entries")
    clean_entries: list[dict[str, Any]] = []
    if isinstance(entries, list):
        for item in entries:
            if not isinstance(item, dict):
                continue
            if not isinstance(item.get("id"), str) or not isinstance(item.get("date"), str):
                continue
            clean_entries.append(
                {
                    "id": item["id"],
                    "type": str(item.get("type") or "אימון").strip() or "אימון",
                    "durationMin": max(1, int(_coerce_number(item.get("durationMin"), 1))),
                    "date": item["date"],
                    "addedAt": int(_coerce_number(item.get("addedAt"), 0)),
                }
            )
    planned = value.get("plannedDays")
    planned_days = [str(x) for x in planned] if isinstance(planned, list) else []
    return {
        "targetSessions": max(1, int(_coerce_number(value.get("targetSessions"), 3))),
        "lastPromptWeek": value.get("lastPromptWeek"),
        "weeklyFeatureSeen": bool(value.get("weeklyFeatureSeen")),
        "plannedDays": planned_days[:7],
        "entries": clean_entries,
    }


class SyncBuckets(BaseModel):
    tracker: Any | None = None
    history: Any | None = None
    recipes: Any | None = None
    meals: Any | None = None
    settings: Any | None = None
    products: Any | None = None
    body: Any | None = None
    workouts: Any | None = None

    @field_validator("tracker", mode="before")
    @classmethod
    def _validate_tracker(cls, value: Any) -> Any:
        return _coerce_tracker(value)

    @field_validator("history", mode="before")
    @classmethod
    def _validate_history(cls, value: Any) -> Any:
        return _coerce_history(value)

    @field_validator("meals", mode="before")
    @classmethod
    def _validate_meals(cls, value: Any) -> Any:
        return _coerce_meals(value)

    @field_validator("recipes", mode="before")
    @classmethod
    def _validate_recipes(cls, value: Any) -> Any:
        return _coerce_recipes(value)

    @field_validator("products", mode="before")
    @classmethod
    def _validate_products(cls, value: Any) -> Any:
        return _coerce_products(value)

    @field_validator("body", mode="before")
    @classmethod
    def _validate_body(cls, value: Any) -> Any:
        return _coerce_body(value)

    @field_validator("workouts", mode="before")
    @classmethod
    def _validate_workouts(cls, value: Any) -> Any:
        return _coerce_workouts(value)


class SyncResponse(BaseModel):
    tracker: Any | None = None
    history: Any | None = None
    recipes: Any | None = None
    meals: Any | None = None
    settings: Any | None = None
    products: Any | None = None
    body: Any | None = None
    workouts: Any | None = None
    updated_at: datetime | None = None


def _decode(value_json: str) -> Any:
    try:
        return json.loads(value_json)
    except (TypeError, ValueError):
        return None


@router.get("", response_model=SyncResponse)
def get_sync(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> SyncResponse:
    rows = (
        db.query(UserData)
        .filter(UserData.user_id == current_user.id)
        .filter(UserData.key.in_(ALLOWED_KEYS))
        .all()
    )
    by_key: dict[str, UserData] = {r.key: r for r in rows}

    latest = max((r.updated_at for r in rows), default=None)

    return SyncResponse(
        tracker=_decode(by_key["tracker"].value_json) if "tracker" in by_key else None,
        history=_decode(by_key["history"].value_json) if "history" in by_key else None,
        recipes=_decode(by_key["recipes"].value_json) if "recipes" in by_key else None,
        meals=_decode(by_key["meals"].value_json) if "meals" in by_key else None,
        settings=_decode(by_key["settings"].value_json) if "settings" in by_key else None,
        products=_decode(by_key["products"].value_json) if "products" in by_key else None,
        body=_decode(by_key["body"].value_json) if "body" in by_key else None,
        workouts=_decode(by_key["workouts"].value_json) if "workouts" in by_key else None,
        updated_at=latest,
    )


@router.put("", response_model=SyncResponse)
def put_sync(
    body: SyncBuckets,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> SyncResponse:
    payload = body.model_dump(exclude_none=False)

    # Look up existing rows once, then upsert in a single transaction.
    existing = {
        r.key: r
        for r in db.query(UserData)
        .filter(UserData.user_id == current_user.id)
        .filter(UserData.key.in_(ALLOWED_KEYS))
        .all()
    }

    for key in ALLOWED_KEYS:
        if key not in payload:
            continue
        value = payload[key]
        if value is None:
            continue
        try:
            value_json = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ערך לא תקין עבור '{key}'",
            )
        if len(value_json.encode("utf-8")) > MAX_BLOB_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"הנתון של '{key}' גדול מדי",
            )

        row = existing.get(key)
        if row is None:
            row = UserData(user_id=current_user.id, key=key, value_json=value_json)
            db.add(row)
        else:
            row.value_json = value_json

    db.commit()

    return get_sync(current_user=current_user, db=db)
