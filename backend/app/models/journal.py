"""Tram Backend - Journal Entry Pydantic Models."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class EmotionalState(str, Enum):
    CALM = "calm"
    CONFIDENT = "confident"
    ANXIOUS = "anxious"
    FEARFUL = "fearful"
    GREEDY = "greedy"
    FRUSTRATED = "frustrated"
    NEUTRAL = "neutral"


class JournalBase(BaseModel):
    title: str | None = None
    content: str | None = None
    trade_id: str | None = None
    mistake_tags: list[str] = Field(default_factory=list)
    emotional_state: EmotionalState | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    screenshots: list[str] = Field(default_factory=list)


class JournalCreate(JournalBase):
    pass


class JournalUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    mistake_tags: list[str] | None = None
    emotional_state: EmotionalState | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    screenshots: list[str] | None = None


class JournalResponse(JournalBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    # Optionally joined trade data
    trade: dict | None = None

    model_config = {"from_attributes": True}


class JournalListResponse(BaseModel):
    entries: list[JournalResponse]
    total: int
