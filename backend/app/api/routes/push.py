"""
Web Push notification endpoints.

POST   /push/subscribe         — save / update subscription for the authenticated user
DELETE /push/unsubscribe       — remove subscription by endpoint
GET    /push/vapid-public-key  — return the VAPID public key for the client
GET    /push/cron/vitamin-reminder  — (Vercel Cron, secured) send reminder to all subscribers
GET    /push/cron/weekly-summary    — (Vercel Cron, secured) send weekly summary
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


def _send_push(sub: PushSubscription, title: str, body: str) -> bool:
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
            data=json.dumps({"title": title, "body": body}),
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
