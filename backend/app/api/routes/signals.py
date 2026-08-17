"""Tram Backend - Signal API Routes."""

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser
from app.core.logging import get_logger
from app.models.signal import SignalListResponse, SignalResponse
from app.services.signal_service import SignalService

logger = get_logger(__name__)
router = APIRouter(prefix="/signals", tags=["signals"])

_service = SignalService()


@router.get("", response_model=SignalListResponse)
async def list_signals(
    user: CurrentUser,
    status: str | None = Query(None, description="Filter by status"),
    symbol: str | None = Query(None, description="Filter by symbol"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List signals for the current user."""
    logger.info("list_signals", user_id=user.id, status=status, symbol=symbol)
    return await _service.list_signals(
        user_id=user.id,
        status=status,
        symbol=symbol,
        limit=limit,
        offset=offset,
    )


@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal(signal_id: str, user: CurrentUser):
    """Get a specific signal by ID."""
    return await _service.get_signal(signal_id=signal_id, user_id=user.id)


@router.delete("/{signal_id}")
async def delete_signal(signal_id: str, user: CurrentUser):
    """Delete a specific signal by ID."""
    logger.info("delete_signal", user_id=user.id, signal_id=signal_id)
    return await _service.delete_signal(signal_id=signal_id, user_id=user.id)


@router.delete("")
async def cleanup_signals(
    user: CurrentUser,
    older_than_days: int = Query(7, ge=1, le=365, description="Delete signals older than N days"),
    status: str | None = Query(None, description="Only delete signals with this status"),
):
    """Bulk cleanup signals older than a given number of days."""
    logger.info(
        "cleanup_signals",
        user_id=user.id,
        older_than_days=older_than_days,
        status=status,
    )
    return await _service.cleanup_signals(
        older_than_days=older_than_days,
        status_filter=status,
    )
