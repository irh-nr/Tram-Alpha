"""Tram Backend - Alert API Routes.

CRUD endpoints for managing user notification preferences.
Each alert defines a channel (telegram/discord/email), event type,
and channel-specific config (e.g., Telegram chat ID).
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from app.api.deps import CurrentUser
from app.core.logging import get_logger
from app.db.client import get_supabase_client
from app.services.notification_service import get_notification_service

logger = get_logger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ── Request/Response Models ──────────────────────────────────────

class AlertCreate(BaseModel):
    channel: str  # "telegram", "discord", "email"
    event_type: str  # "new_signal", "trade_closed", "price_alert", "journal_reminder"
    config: dict = {}  # channel-specific config, e.g. {"chat_id": "12345"}
    is_active: bool = True

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        valid = {"telegram", "discord", "email"}
        if v not in valid:
            raise ValueError(f"channel must be one of: {valid}")
        return v

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        valid = {"new_signal", "trade_closed", "price_alert", "journal_reminder"}
        if v not in valid:
            raise ValueError(f"event_type must be one of: {valid}")
        return v


class AlertUpdate(BaseModel):
    config: dict | None = None
    is_active: bool | None = None


class TestTelegramRequest(BaseModel):
    chat_id: str


# ── Routes ───────────────────────────────────────────────────────

@router.get("")
async def list_alerts(user: CurrentUser):
    """List all alert subscriptions for the current user."""
    client = await get_supabase_client()

    result = await (
        client.from_("alerts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"alerts": result.data, "total": len(result.data)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_alert(body: AlertCreate, user: CurrentUser):
    """Create a new alert subscription."""
    client = await get_supabase_client()

    # Check for duplicate (same user + channel + event_type)
    existing = await (
        client.from_("alerts")
        .select("id")
        .eq("user_id", user.id)
        .eq("channel", body.channel)
        .eq("event_type", body.event_type)
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Alert for {body.channel}/{body.event_type} already exists. Use PATCH to update.",
        )

    result = await (
        client.from_("alerts")
        .insert({
            "user_id": user.id,
            "channel": body.channel,
            "event_type": body.event_type,
            "config": body.config,
            "is_active": body.is_active,
        })
        .execute()
    )

    logger.info(
        "alert_created",
        user_id=user.id,
        channel=body.channel,
        event_type=body.event_type,
    )

    return result.data[0] if result.data else {}


@router.patch("/{alert_id}")
async def update_alert(alert_id: str, body: AlertUpdate, user: CurrentUser):
    """Update an alert subscription (config or active state)."""
    client = await get_supabase_client()

    # Verify ownership
    existing = await (
        client.from_("alerts")
        .select("id")
        .eq("id", alert_id)
        .eq("user_id", user.id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    update_data = {}
    if body.config is not None:
        update_data["config"] = body.config
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = await (
        client.from_("alerts")
        .update(update_data)
        .eq("id", alert_id)
        .eq("user_id", user.id)
        .execute()
    )

    logger.info("alert_updated", alert_id=alert_id, fields=list(update_data.keys()))

    return result.data[0] if result.data else {}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, user: CurrentUser):
    """Delete an alert subscription."""
    client = await get_supabase_client()

    # Verify ownership
    existing = await (
        client.from_("alerts")
        .select("id")
        .eq("id", alert_id)
        .eq("user_id", user.id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    await (
        client.from_("alerts")
        .delete()
        .eq("id", alert_id)
        .eq("user_id", user.id)
        .execute()
    )

    logger.info("alert_deleted", alert_id=alert_id, user_id=user.id)

    return {"message": "Alert deleted"}


@router.post("/test-telegram")
async def test_telegram(body: TestTelegramRequest, user: CurrentUser):
    """Send a test message to verify Telegram connectivity."""
    service = get_notification_service()
    result = await service.test_telegram_connection(body.chat_id)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"],
        )

    return result
