"""Tram Backend - Scanner Status & Watchlist API Routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/scanner", tags=["scanner"])

# Global scanner engine reference — set by the lifespan
_scanner_engine = None


def set_scanner_engine(engine):
    """Set the global scanner engine reference."""
    global _scanner_engine
    _scanner_engine = engine


def get_scanner_engine():
    """Get the global scanner engine reference."""
    return _scanner_engine


# ── Status ───────────────────────────────────────────────────────

@router.get("/status")
async def scanner_status():
    """Get current scanner engine status."""
    engine = get_scanner_engine()
    if engine is None:
        return {
            "running": False,
            "connected": False,
            "message": "Scanner not initialized. Run the scanner worker separately.",
        }
    return engine.get_status()


# ── Watchlist ────────────────────────────────────────────────────

class AddSymbolRequest(BaseModel):
    symbol: str


@router.get("/watchlist")
async def get_watchlist():
    """Get the current list of monitored symbols."""
    engine = get_scanner_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="Scanner not initialized")
    return {"symbols": engine.symbols}


@router.post("/watchlist")
async def add_to_watchlist(body: AddSymbolRequest):
    """Add a symbol to the scanner watchlist.

    Triggers historical candle backfill and WebSocket reconnection
    to start streaming data for the new symbol.
    """
    engine = get_scanner_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="Scanner not initialized")

    symbol = body.symbol.upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol cannot be empty")

    added = await engine.add_symbol(symbol)
    if not added:
        raise HTTPException(
            status_code=409,
            detail=f"{symbol} is already in the watchlist",
        )

    return {
        "message": f"{symbol} added to watchlist",
        "symbols": engine.symbols,
    }


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str):
    """Remove a symbol from the scanner watchlist.

    Triggers WebSocket reconnection to stop streaming data
    for the removed symbol.
    """
    engine = get_scanner_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="Scanner not initialized")

    normalized = symbol.upper().strip()
    removed = await engine.remove_symbol(normalized)
    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"{normalized} is not in the watchlist",
        )

    return {
        "message": f"{normalized} removed from watchlist",
        "symbols": engine.symbols,
    }
