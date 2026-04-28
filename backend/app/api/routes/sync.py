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
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.database import get_db
from app.db.models import User, UserData

router = APIRouter(prefix="/sync", tags=["sync"])

# Whitelist of bucket keys the API will accept. Anything else is rejected so
# clients can't pollute the table with arbitrary keys.
ALLOWED_KEYS: set[str] = {"tracker", "history", "recipes", "meals", "settings"}

# Hard cap per blob to keep DB rows small (50 KB is plenty for years of usage).
MAX_BLOB_BYTES = 50_000


class SyncBuckets(BaseModel):
    tracker: Any | None = None
    history: Any | None = None
    recipes: Any | None = None
    meals: Any | None = None
    settings: Any | None = None


class SyncResponse(BaseModel):
    tracker: Any | None = None
    history: Any | None = None
    recipes: Any | None = None
    meals: Any | None = None
    settings: Any | None = None
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
