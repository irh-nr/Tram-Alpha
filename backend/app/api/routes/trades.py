"""Tram Backend - Trade API Routes."""

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser
from app.core.logging import get_logger
from app.models.trade import (
    TradeCreate,
    TradeListResponse,
    TradeResponse,
    TradeUpdate,
)
from app.services.trade_service import TradeService

logger = get_logger(__name__)
router = APIRouter(prefix="/trades", tags=["trades"])

_service = TradeService()


@router.get("", response_model=TradeListResponse)
async def list_trades(
    user: CurrentUser,
    status: str | None = Query(None),
    symbol: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List trades for the current user."""
    return await _service.list_trades(
        user_id=user.id,
        status=status,
        symbol=symbol,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=TradeResponse, status_code=201)
async def create_trade(trade: TradeCreate, user: CurrentUser):
    """Create a new trade entry."""
    logger.info("create_trade", user_id=user.id, symbol=trade.symbol)
    return await _service.create_trade(user_id=user.id, trade=trade)


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(trade_id: str, user: CurrentUser):
    """Get a specific trade."""
    return await _service.get_trade(trade_id=trade_id, user_id=user.id)


@router.patch("/{trade_id}", response_model=TradeResponse)
async def update_trade(trade_id: str, trade: TradeUpdate, user: CurrentUser):
    """Update a trade (close, add PnL, etc)."""
    return await _service.update_trade(
        trade_id=trade_id, user_id=user.id, trade=trade
    )


@router.delete("/{trade_id}", status_code=204)
async def delete_trade(trade_id: str, user: CurrentUser):
    """Delete a trade."""
    await _service.delete_trade(trade_id=trade_id, user_id=user.id)

