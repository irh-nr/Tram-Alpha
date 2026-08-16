"""Tram Backend - Trade Pydantic Models."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TradeDirection(str, Enum):
    LONG = "long"
    SHORT = "short"


class TradeStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class TradeBase(BaseModel):
    symbol: str = Field(..., example="BTCUSDT")
    direction: TradeDirection
    entry_price: float
    position_size: float = 0
    leverage: float = 1
    strategy_name: str | None = None
    timeframe: str | None = None


class TradeCreate(TradeBase):
    signal_id: str | None = None
    entry_time: datetime | None = None


class TradeUpdate(BaseModel):
    exit_price: float | None = None
    exit_time: datetime | None = None
    status: TradeStatus | None = None
    pnl_amount: float | None = None
    pnl_percent: float | None = None
    fees: float | None = None
    rr_achieved: float | None = None


class TradeResponse(TradeBase):
    id: str
    user_id: str
    signal_id: str | None = None
    status: TradeStatus = TradeStatus.OPEN
    exit_price: float | None = None
    pnl_amount: float = 0
    pnl_percent: float = 0
    fees: float = 0
    rr_achieved: float = 0
    entry_time: datetime
    exit_time: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TradeListResponse(BaseModel):
    trades: list[TradeResponse]
    total: int
