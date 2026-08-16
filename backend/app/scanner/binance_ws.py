"""Tram Backend - Binance WebSocket Client for Kline Streams.

Connects to Binance's public WebSocket API to receive real-time candlestick
(kline) data. No API key required for public market data streams.

Architecture:
    - Single combined stream connection for multiple symbols/timeframes
    - Auto-reconnect with exponential backoff
    - Async callback dispatch for each completed candle
    - Clean shutdown via cancellation
"""

import asyncio
import json
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosed

from app.core.logging import get_logger

logger = get_logger(__name__)

BINANCE_WS_BASE = "wss://stream.binance.com:9443"
BINANCE_WS_COMBINED = f"{BINANCE_WS_BASE}/stream"
BINANCE_REST_BASE = "https://api.binance.com/api/v3"

# Reconnection parameters
INITIAL_BACKOFF_S = 1.0
MAX_BACKOFF_S = 60.0
BACKOFF_MULTIPLIER = 2.0


async def fetch_historical_klines(
    symbol: str,
    interval: str,
    limit: int = 200,
) -> list["Candle"]:
    """Fetch historical klines from Binance REST API for buffer backfill.

    No API key required for public market data.

    Args:
        symbol: Trading pair (e.g. "BTCUSDT")
        interval: Kline interval (e.g. "1h", "4h")
        limit: Number of candles to fetch (max 1000)

    Returns:
        List of Candle objects, oldest first.
    """
    import httpx

    url = f"{BINANCE_REST_BASE}/klines"
    params = {
        "symbol": symbol.upper(),
        "interval": interval,
        "limit": min(limit, 1000),
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        raw_klines = resp.json()

    candles = []
    for k in raw_klines:
        # Binance REST kline format: [openTime, open, high, low, close, volume,
        #   closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
        candle = Candle(
            symbol=symbol.upper(),
            timeframe=interval,
            open_time=datetime.fromtimestamp(k[0] / 1000, tz=UTC),
            close_time=datetime.fromtimestamp(k[6] / 1000, tz=UTC),
            open=float(k[1]),
            high=float(k[2]),
            low=float(k[3]),
            close=float(k[4]),
            volume=float(k[5]),
            quote_volume=float(k[7]),
            trades=int(k[8]),
            is_closed=True,  # Historical klines are always closed
        )
        candles.append(candle)

    # Drop the last candle if it's the currently-open one
    # (Binance returns the in-progress candle as the last item)
    if candles:
        candles.pop()

    return candles


@dataclass(frozen=True)
class Candle:
    """Represents a single candlestick (OHLCV) data point."""

    symbol: str
    timeframe: str
    open_time: datetime
    close_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    quote_volume: float
    trades: int
    is_closed: bool

    @classmethod
    def from_binance_kline(cls, symbol: str, timeframe: str, k: dict) -> "Candle":
        """Parse a Binance kline event payload into a Candle."""
        return cls(
            symbol=symbol.upper(),
            timeframe=timeframe,
            open_time=datetime.fromtimestamp(k["t"] / 1000, tz=UTC),
            close_time=datetime.fromtimestamp(k["T"] / 1000, tz=UTC),
            open=float(k["o"]),
            high=float(k["h"]),
            low=float(k["l"]),
            close=float(k["c"]),
            volume=float(k["v"]),
            quote_volume=float(k["q"]),
            trades=int(k["n"]),
            is_closed=bool(k["x"]),
        )


# Type alias for candle callbacks
CandleCallback = Callable[[Candle], Coroutine[Any, Any, None]]


@dataclass
class BinanceWSClient:
    """WebSocket client for Binance kline (candlestick) streams.

    Usage:
        client = BinanceWSClient(
            symbols=["BTCUSDT", "ETHUSDT", "SOLUSDT"],
            timeframes=["1h", "4h"],
            on_candle=my_async_callback,
        )
        await client.start()  # runs until cancelled
    """

    symbols: list[str]
    timeframes: list[str]
    on_candle: CandleCallback
    on_error: Callable[[Exception], Coroutine[Any, Any, None]] | None = None

    _ws: Any = field(default=None, init=False, repr=False)
    _running: bool = field(default=False, init=False, repr=False)
    _reconnect_count: int = field(default=0, init=False, repr=False)

    def _build_stream_names(self) -> list[str]:
        """Build Binance combined stream names: symbol@kline_timeframe."""
        streams = []
        for symbol in self.symbols:
            for tf in self.timeframes:
                stream_name = f"{symbol.lower()}@kline_{tf}"
                streams.append(stream_name)
        return streams

    def _build_ws_url(self) -> str:
        """Build the combined stream WebSocket URL."""
        streams = self._build_stream_names()
        stream_param = "/".join(streams)
        return f"{BINANCE_WS_COMBINED}?streams={stream_param}"

    async def start(self) -> None:
        """Start the WebSocket connection with auto-reconnect."""
        self._running = True
        backoff = INITIAL_BACKOFF_S

        url = self._build_ws_url()
        stream_count = len(self.symbols) * len(self.timeframes)
        logger.info(
            "binance_ws_starting",
            symbols=self.symbols,
            timeframes=self.timeframes,
            stream_count=stream_count,
            url=url[:80] + "...",
        )

        while self._running:
            try:
                async with websockets.connect(
                    url,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=5,
                    max_size=2**20,  # 1MB max message size
                ) as ws:
                    self._ws = ws
                    self._reconnect_count = 0
                    backoff = INITIAL_BACKOFF_S

                    logger.info(
                        "binance_ws_connected",
                        stream_count=stream_count,
                    )

                    await self._listen(ws)

            except ConnectionClosed as e:
                if not self._running:
                    break
                logger.warning(
                    "binance_ws_disconnected",
                    code=e.code,
                    reason=str(e.reason)[:100],
                )

            except Exception as e:
                if not self._running:
                    break
                logger.error("binance_ws_error", error=str(e))
                if self.on_error:
                    await self.on_error(e)

            if self._running:
                self._reconnect_count += 1
                logger.info(
                    "binance_ws_reconnecting",
                    attempt=self._reconnect_count,
                    backoff_s=backoff,
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_S)

    async def _listen(self, ws: Any) -> None:
        """Listen for messages on the WebSocket."""
        async for raw_message in ws:
            try:
                message = json.loads(raw_message)
                await self._handle_message(message)
            except json.JSONDecodeError:
                logger.warning("binance_ws_invalid_json", data=str(raw_message)[:200])
            except Exception as e:
                logger.error("binance_ws_message_error", error=str(e))

    async def _handle_message(self, message: dict) -> None:
        """Parse combined stream message and dispatch candle callback."""
        # Combined stream format: {"stream": "btcusdt@kline_1h", "data": {...}}
        stream_name = message.get("stream", "")
        data = message.get("data", {})

        if not data or data.get("e") != "kline":
            return

        # Extract symbol and timeframe from stream name
        parts = stream_name.split("@kline_")
        if len(parts) != 2:
            return

        symbol = parts[0].upper()
        timeframe = parts[1]
        kline_data = data.get("k", {})

        candle = Candle.from_binance_kline(symbol, timeframe, kline_data)
        await self.on_candle(candle)

    async def stop(self) -> None:
        """Gracefully stop the WebSocket connection."""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
        logger.info("binance_ws_stopped")

    @property
    def is_connected(self) -> bool:
        """Check if the WebSocket is currently connected."""
        if self._ws is None:
            return False
        try:
            return self._ws.state.name == "OPEN"
        except AttributeError:
            return False
