"""Tram Backend - Journal Entry Service."""

from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.core.logging import get_logger
from app.db.client import get_supabase_client
from app.models.journal import (
    JournalCreate,
    JournalListResponse,
    JournalResponse,
    JournalUpdate,
)

logger = get_logger(__name__)


class JournalService:
    """Business logic for journal entry operations."""

    async def list_entries(
        self,
        user_id: str,
        trade_id: str | None = None,
        emotional_state: str | None = None,
        tag: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> JournalListResponse:
        """List journal entries with optional filters."""
        client = await get_supabase_client()

        query = (
            client.from_("journal_entries")
            .select(
                "*, trades(id, symbol, direction, status, pnl_amount, pnl_percent, entry_price, exit_price)",
                count="exact",
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )

        if trade_id:
            query = query.eq("trade_id", trade_id)
        if emotional_state:
            query = query.eq("emotional_state", emotional_state)
        if tag:
            query = query.contains("mistake_tags", [tag])

        result = await query.execute()

        entries = []
        for row in result.data:
            trade_data = row.pop("trades", None)
            entries.append(JournalResponse(**row, trade=trade_data))

        return JournalListResponse(entries=entries, total=result.count or 0)

    async def create_entry(
        self, user_id: str, entry: JournalCreate
    ) -> JournalResponse:
        """Create a new journal entry."""
        client = await get_supabase_client()

        data = entry.model_dump(exclude_none=True)
        data["user_id"] = user_id

        # If linking to a trade, verify ownership
        if data.get("trade_id"):
            trade_check = (
                await client.from_("trades")
                .select("id")
                .eq("id", data["trade_id"])
                .eq("user_id", user_id)
                .execute()
            )
            if not trade_check.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Trade not found or not owned by user",
                )

        result = await client.from_("journal_entries").insert(data).execute()

        logger.info(
            "journal_entry_created",
            user_id=user_id,
            entry_id=result.data[0]["id"],
            has_trade=bool(data.get("trade_id")),
        )
        return JournalResponse(**result.data[0])

    async def get_entry(self, entry_id: str, user_id: str) -> JournalResponse:
        """Get a single journal entry."""
        client = await get_supabase_client()

        result = (
            await client.from_("journal_entries")
            .select(
                "*, trades(id, symbol, direction, status, pnl_amount, pnl_percent, entry_price, exit_price)"
            )
            .eq("id", entry_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found",
            )

        trade_data = result.data.pop("trades", None)
        return JournalResponse(**result.data, trade=trade_data)

    async def update_entry(
        self, entry_id: str, user_id: str, entry: JournalUpdate
    ) -> JournalResponse:
        """Update a journal entry."""
        client = await get_supabase_client()

        data = entry.model_dump(exclude_none=True)
        data["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            await client.from_("journal_entries")
            .update(data)
            .eq("id", entry_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found",
            )

        logger.info("journal_entry_updated", entry_id=entry_id)
        return JournalResponse(**result.data[0])

    async def delete_entry(self, entry_id: str, user_id: str) -> None:
        """Delete a journal entry."""
        client = await get_supabase_client()

        result = (
            await client.from_("journal_entries")
            .delete()
            .eq("id", entry_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found",
            )

        logger.info("journal_entry_deleted", entry_id=entry_id)

    async def get_unique_tags(self, user_id: str) -> list[str]:
        """Get all unique mistake tags used by a user."""
        client = await get_supabase_client()

        result = (
            await client.from_("journal_entries")
            .select("mistake_tags")
            .eq("user_id", user_id)
            .execute()
        )

        # Flatten all tags and deduplicate
        all_tags: set[str] = set()
        for row in result.data:
            tags = row.get("mistake_tags", [])
            if tags:
                all_tags.update(tags)

        return sorted(all_tags)
