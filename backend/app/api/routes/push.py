"""
Web Push notification endpoints.

POST   /push/subscribe              — save / update subscription for the authenticated user
DELETE /push/unsubscribe            — remove subscription by endpoint
GET    /push/vapid-public-key       — return the VAPID public key for the client
GET    /push/cron/vitamin-reminder  — 08:00 IL — remind users to take vitamins
GET    /push/cron/meal-reminder     — 12:00 IL — remind users to log meals if empty
GET    /push/cron/water-reminder    — 16:00 IL — remind users to log water if empty
GET    /push/cron/evening-reminder  — 20:00 IL — evening nudge to complete the journal
GET    /push/cron/weekly-summary    — Sunday 08:00 IL — weekly activity summary
"""
from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.db.models import PushSubscription, User, UserData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["push"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SubscribeIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class UnsubscribeIn(BaseModel):
    endpoint: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_cron(x_cron_secret: Annotated[str | None, Header()] = None) -> None:
    """Dependency: reject cron endpoint calls that lack the shared secret."""
    if not settings.cron_secret:
        return  # secret not configured → open in dev
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")


def _has_entries_today(db: Session, user_id: int) -> bool:
    """Return True if the user has at least one food entry logged for today."""
    import datetime
    today = datetime.date.today().isoformat()
    bucket = (
        db.query(UserData)
        .filter(UserData.user_id == user_id, UserData.key == "tracker")
        .first()
    )
    if not bucket:
        return False
    try:
        data = json.loads(bucket.value_json)
        # tracker blob: {"date": "YYYY-MM-DD", "entries": [...], ...}
        if isinstance(data, dict):
            return data.get("date") == today and len(data.get("entries", [])) > 0
    except Exception:
        pass
    return False


def _reached_water_goal_today(db: Session, user_id: int) -> bool:
    """Return True if the user has reached their daily water goal today."""
    import datetime
    today = datetime.date.today().isoformat()
    bucket = (
        db.query(UserData)
        .filter(UserData.user_id == user_id, UserData.key == "water")
        .first()
    )
    if not bucket:
        return False
    try:
        data = json.loads(bucket.value_json)
        # water blob: {"date": "YYYY-MM-DD", "entries": [{"amountMl": ...}], "goalMl": ...}
        if isinstance(data, dict) and data.get("date") == today:
            entries = data.get("entries", [])
            total_ml = sum(e.get("amountMl", 0) for e in entries if isinstance(e, dict))
            goal_ml = data.get("goalMl", 2000)
            return total_ml >= goal_ml
    except Exception:
        pass
    return False


def _send_push(sub: PushSubscription, title: str, body: str, tag: str = "calorie-reminder") -> bool:
    """Send a single web push. Returns True on success."""
    if not settings.vapid_private_key or not settings.vapid_subject:
        logger.warning("VAPID not configured — skipping push")
        return False
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps({"title": title, "body": body, "tag": tag}),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
        )
        return True
    except WebPushException as exc:
        logger.warning("Push failed for endpoint %s: %s", sub.endpoint[:40], exc)
        return False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/vapid-public-key")
def vapid_public_key() -> dict[str, str]:
    if not settings.vapid_public_key:
        raise HTTPException(status_code=503, detail="Push not configured")
    return {"public_key": settings.vapid_public_key}


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(
    body: SubscribeIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> None:
    existing = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == body.endpoint)
        .first()
    )
    if existing:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        existing.user_id = current_user.id
    else:
        db.add(
            PushSubscription(
                user_id=current_user.id,
                endpoint=body.endpoint,
                p256dh=body.p256dh,
                auth=body.auth,
            )
        )
    db.commit()


@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    body: UnsubscribeIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> None:
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == body.endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()


@router.get("/cron/vitamin-reminder", dependencies=[Depends(_require_cron)])
def cron_vitamin_reminder(db: Session = Depends(get_db)) -> dict[str, int]:
    """Send a vitamin reminder to every subscribed user that has vitamins configured."""
    subs = db.query(PushSubscription).all()
    sent = failed = skipped = 0
    for sub in subs:
        # Only notify users who have vitamins configured.
        bucket = (
            db.query(UserData)
            .filter(UserData.user_id == sub.user_id, UserData.key == "vitamins_config")
            .first()
        )
        if bucket:
            try:
                data = json.loads(bucket.value_json)
            except Exception:
                data = []
            if not data:
                skipped += 1
                continue
        else:
            skipped += 1
            continue

        ok = _send_push(
            sub,
            title="⏰ זמן ויטמינים!",
            body="זכור לקחת את הויטמינים ותוספי התזונה שלך להיום.",
        )
        if ok:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed, "skipped": skipped}


@router.get("/cron/meal-reminder", dependencies=[Depends(_require_cron)])
def cron_meal_reminder(db: Session = Depends(get_db)) -> dict[str, int]:
    """12:00 IL — remind users who have not logged any food today."""
    subs = db.query(PushSubscription).all()
    sent = failed = skipped = 0
    for sub in subs:
        if _has_entries_today(db, sub.user_id):
            skipped += 1
            continue
        ok = _send_push(
            sub,
            title="🍽️ זכרת לרשום את הארוחות?",
            body="פתח את היומן והוסף את מה שאכלת היום — זה לוקח שניות!",
            tag="meal-reminder",
        )
        if ok:
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "skipped": skipped}


@router.get("/cron/water-reminder", dependencies=[Depends(_require_cron)])
def cron_water_reminder(db: Session = Depends(get_db)) -> dict[str, int]:
    """20:30 IL — remind users who haven't reached their daily water goal."""
    subs = db.query(PushSubscription).all()
    sent = failed = skipped = 0
    for sub in subs:
        if _reached_water_goal_today(db, sub.user_id):
            skipped += 1
            continue
        ok = _send_push(
            sub,
            title="💧 עוד לא הגעת ליעד המים שלך!",
            body="שתה עוד קצת לפני השינה — גוף מימי ישן טוב יותר 😴",
            tag="water-reminder",
        )
        if ok:
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "skipped": skipped}


@router.get("/cron/evening-reminder", dependencies=[Depends(_require_cron)])
def cron_evening_reminder(db: Session = Depends(get_db)) -> dict[str, int]:
    """20:00 IL — evening nudge to complete the daily journal."""
    subs = db.query(PushSubscription).all()
    sent = failed = skipped = 0
    for sub in subs:
        # Only remind users who have started tracking (have at least some history)
        has_tracker = (
            db.query(UserData)
            .filter(UserData.user_id == sub.user_id, UserData.key == "tracker")
            .first()
        )
        if not has_tracker:
            skipped += 1
            continue
        ok = _send_push(
            sub,
            title="🌙 סיכום יום — הוספת הכל?",
            body="לפני שישנים — האם סיימת לרשום את כל הארוחות של היום?",
            tag="evening-reminder",
        )
        if ok:
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "skipped": skipped}


@router.get("/cron/weekly-summary", dependencies=[Depends(_require_cron)])
def cron_weekly_summary(db: Session = Depends(get_db)) -> dict[str, int]:
    """Send a weekly activity summary to every subscribed user."""
    subs = db.query(PushSubscription).all()
    sent = failed = 0
    for sub in subs:
        ok = _send_push(
            sub,
            title="📊 סיכום שבועי",
            body="בוא לראות איך היה השבוע שלך — מעקב קלוריות, ויטמינים ועוד.",
        )
        if ok:
            sent += 1
        else:
            failed += 1

    return {"sent": sent, "failed": failed}
