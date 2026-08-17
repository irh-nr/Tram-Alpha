"""Tram Backend - Signal Service."""

from fastapi import HTTPException, status

from app.core.logging import get_logger
from app.db.client import get_supabase_client
from app.models.signal import SignalListResponse, SignalResponse

logger = get_logger(__name__)


class SignalService:
    """Business logic for signal operations."""

    async def list_signals(
        self,
        user_id: str,
        status: str | None = None,
        symbol: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> SignalListResponse:
        """List signals with optional filters."""
        client = await get_supabase_client()

        query = (
            client.from_("signals")
            .select("*, strategies(name)", count="exact")
            .or_(f"user_id.eq.{user_id},user_id.is.null")
            .order("detected_at", desc=True)
            .range(offset, offset + limit - 1)
        )

        if status:
            query = query.eq("status", status)
        if symbol:
            query = query.eq("symbol", symbol)

        result = await query.execute()

        signals = []
        for row in result.data:
            strategy_name = None
            if row.get("strategies"):
                strategy_name = row["strategies"].get("name")
            signals.append(
                SignalResponse(
                    **{k: v for k, v in row.items() if k != "strategies"},
                    strategy_name=strategy_name,
                )
            )

        return SignalListResponse(signals=signals, total=result.count or 0)

    async def get_signal(self, signal_id: str, user_id: str) -> SignalResponse:
        """Get a specific signal by ID."""
        client = await get_supabase_client()

        result = (
            await client.from_("signals")
            .select("*, strategies(name)")
            .eq("id", signal_id)
            .or_(f"user_id.eq.{user_id},user_id.is.null")
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signal not found",
            )

        row = result.data
        strategy_name = None
        if row.get("strategies"):
            strategy_name = row["strategies"].get("name")

        return SignalResponse(
            **{k: v for k, v in row.items() if k != "strategies"},
            strategy_name=strategy_name,
        )

    async def delete_signal(self, signal_id: str, user_id: str) -> dict:
        """Delete a specific signal by ID."""
        client = await get_supabase_client()

        # Verify signal exists and belongs to user (or is system)
        result = (
            await client.from_("signals")
            .select("id")
            .eq("id", signal_id)
            .or_(f"user_id.eq.{user_id},user_id.is.null")
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signal not found",
            )

        await (
            client.from_("signals")
            .delete()
            .eq("id", signal_id)
            .execute()
        )

        logger.info("signal_deleted", signal_id=signal_id, user_id=user_id)
        return {"status": "deleted", "signal_id": signal_id}

    async def cleanup_signals(
        self, older_than_days: int = 7, status_filter: str | None = None
    ) -> dict:
        """Bulk delete signals older than a given number of days."""
        from datetime import datetime, timedelta, timezone

        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        cutoff_str = cutoff.isoformat()

        client = await get_supabase_client()

        query = (
            client.from_("signals")
            .delete()
            .lt("detected_at", cutoff_str)
        )

        if status_filter:
            query = query.eq("status", status_filter)

        result = await query.execute()
        deleted_count = len(result.data) if result.data else 0

        logger.info(
            "signals_cleanup",
            older_than_days=older_than_days,
            status_filter=status_filter,
            deleted_count=deleted_count,
        )

        return {
            "status": "cleanup_complete",
            "deleted_count": deleted_count,
            "cutoff": cutoff_str,
        }

