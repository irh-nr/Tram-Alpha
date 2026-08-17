"""Tram Backend - Trade Service."""

from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.core.logging import get_logger
from app.db.client import get_supabase_client
from app.models.trade import (
    TradeCreate,
    TradeListResponse,
    TradeResponse,
    TradeUpdate,
)

logger = get_logger(__name__)


class TradeService:
    """Business logic for trade operations."""

    async def list_trades(
        self,
        user_id: str,
        status: str | None = None,
        symbol: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TradeListResponse:
        """List trades for a user."""
        client = await get_supabase_client()

        query = (
            client.from_("trades")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )

        if status:
            query = query.eq("status", status)
        if symbol:
            query = query.eq("symbol", symbol)

        result = await query.execute()

        trades = [TradeResponse(**row) for row in result.data]
        return TradeListResponse(trades=trades, total=result.count or 0)

    async def create_trade(self, user_id: str, trade: TradeCreate) -> TradeResponse:
        """Create a new trade."""
        client = await get_supabase_client()

        data = trade.model_dump(exclude_none=True)
        data["user_id"] = user_id
        if not data.get("entry_time"):
            data["entry_time"] = datetime.now(timezone.utc).isoformat()

        result = await client.from_("trades").insert(data).execute()

        logger.info("trade_created", user_id=user_id, trade_id=result.data[0]["id"])
        return TradeResponse(**result.data[0])

    async def get_trade(self, trade_id: str, user_id: str) -> TradeResponse:
        """Get a single trade."""
        client = await get_supabase_client()

        result = (
            await client.from_("trades")
            .select("*")
            .eq("id", trade_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trade not found",
            )

        return TradeResponse(**result.data)

    async def update_trade(
        self, trade_id: str, user_id: str, trade: TradeUpdate
    ) -> TradeResponse:
        """Update a trade."""
        client = await get_supabase_client()

        data = trade.model_dump(exclude_none=True)
        if "exit_price" in data and "exit_time" not in data:
            data["exit_time"] = datetime.now(timezone.utc).isoformat()
        if "exit_price" in data:
            data["status"] = "closed"

        result = (
            await client.from_("trades")
            .update(data)
            .eq("id", trade_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trade not found",
            )

        logger.info("trade_updated", trade_id=trade_id, updates=list(data.keys()))
        return TradeResponse(**result.data[0])

    async def delete_trade(self, trade_id: str, user_id: str) -> None:
        """Delete a trade."""
        client = await get_supabase_client()

        result = (
            await client.from_("trades")
            .delete()
            .eq("id", trade_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trade not found",
            )

        logger.info("trade_deleted", trade_id=trade_id)

