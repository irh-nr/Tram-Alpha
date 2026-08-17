"""Tram Backend - Signal Pydantic Models."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SignalDirection(str, Enum):
    LONG = "long"
    SHORT = "short"


class SignalStatus(str, Enum):
    ACTIVE = "active"
    TRIGGERED = "triggered"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class SignalBase(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    timeframe: str = Field(..., example="1h")
    direction: SignalDirection
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float = Field(default=0, ge=0, le=100)
    strategy_id: str | None = None


class SignalCreate(SignalBase):
    metadata: dict = Field(default_factory=dict)


class SignalResponse(SignalBase):
    id: str
    risk_reward: float | None = None
    status: SignalStatus = SignalStatus.ACTIVE
    strategy_name: str | None = None
    metadata: dict = Field(default_factory=dict)
    detected_at: datetime
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class SignalListResponse(BaseModel):
    signals: list[SignalResponse]
    total: int
