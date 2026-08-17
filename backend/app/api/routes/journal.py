"""Tram Backend - Journal API Routes."""

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser
from app.core.logging import get_logger
from app.models.journal import (
    JournalCreate,
    JournalListResponse,
    JournalResponse,
    JournalUpdate,
)
from app.services.journal_service import JournalService

logger = get_logger(__name__)
router = APIRouter(prefix="/journal", tags=["journal"])

_service = JournalService()


@router.get("", response_model=JournalListResponse)
async def list_journal_entries(
    user: CurrentUser,
    trade_id: str | None = Query(None),
    emotional_state: str | None = Query(None),
    tag: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List journal entries for the current user."""
    return await _service.list_entries(
        user_id=user.id,
        trade_id=trade_id,
        emotional_state=emotional_state,
        tag=tag,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=JournalResponse, status_code=201)
async def create_journal_entry(entry: JournalCreate, user: CurrentUser):
    """Create a new journal entry."""
    logger.info("create_journal_entry", user_id=user.id, title=entry.title)
    return await _service.create_entry(user_id=user.id, entry=entry)


@router.get("/tags")
async def get_unique_tags(user: CurrentUser):
    """Get all unique mistake tags used by the current user."""
    tags = await _service.get_unique_tags(user_id=user.id)
    return {"tags": tags}


@router.get("/{entry_id}", response_model=JournalResponse)
async def get_journal_entry(entry_id: str, user: CurrentUser):
    """Get a specific journal entry."""
    return await _service.get_entry(entry_id=entry_id, user_id=user.id)


@router.patch("/{entry_id}", response_model=JournalResponse)
async def update_journal_entry(
    entry_id: str, entry: JournalUpdate, user: CurrentUser
):
    """Update a journal entry."""
    return await _service.update_entry(
        entry_id=entry_id, user_id=user.id, entry=entry
    )


@router.delete("/{entry_id}", status_code=204)
async def delete_journal_entry(entry_id: str, user: CurrentUser):
    """Delete a journal entry."""
    await _service.delete_entry(entry_id=entry_id, user_id=user.id)
