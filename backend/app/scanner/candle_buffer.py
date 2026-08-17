"""Tram Backend - Candle Buffer & Technical Indicator Calculations.

Maintains an in-memory rolling buffer of candles per symbol/timeframe pair.
Provides efficient indicator calculations using numpy for the strategy engine.

Design decisions:
    - Fixed-size deque buffers (default 200 candles) — enough for most indicators
    - Numpy-based indicator math for speed
    - Thread-safe via asyncio (single event loop)
    - Indicators computed on-demand, not stored
"""

from collections import deque
from dataclasses import dataclass, field

import numpy as np

from app.core.logging import get_logger
from app.scanner.binance_ws import Candle

logger = get_logger(__name__)

DEFAULT_BUFFER_SIZE = 200


@dataclass
class IndicatorResult:
    """Result container for technical indicator calculations."""

    ema_fast: float | None = None
    ema_slow: float | None = None
    ema_signal: float | None = None
    rsi: float | None = None
    atr: float | None = None
    volume_sma: float | None = None
    volume_ratio: float | None = None
    current_close: float | None = None
    current_high: float | None = None
    current_low: float | None = None
    current_volume: float | None = None

    # Previous values for crossover detection
    prev_ema_fast: float | None = None
    prev_ema_slow: float | None = None
    prev_rsi: float | None = None


def _ema(data: np.ndarray, period: int) -> np.ndarray:
    """Calculate Exponential Moving Average.

    Uses the standard smoothing factor: alpha = 2 / (period + 1).
    The first EMA value is the SMA of the first 'period' values.
    """
    if len(data) < period:
        return np.full(len(data), np.nan)

    alpha = 2.0 / (period + 1)
    ema_values = np.empty(len(data))
    ema_values[:period - 1] = np.nan

    # Seed with SMA
    ema_values[period - 1] = np.mean(data[:period])

    # EMA forward pass
    for i in range(period, len(data)):
        ema_values[i] = alpha * data[i] + (1 - alpha) * ema_values[i - 1]

    return ema_values


def _rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    """Calculate Relative Strength Index using Wilder's smoothing.

    Returns array with NaN for insufficient data points.
    """
    if len(closes) < period + 1:
        return np.full(len(closes), np.nan)

    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    rsi_values = np.full(len(closes), np.nan)

    # Initial average gain/loss (SMA for first period)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    if avg_loss == 0:
        rsi_values[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi_values[period] = 100.0 - (100.0 / (1.0 + rs))

    # Wilder's smoothing
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            rsi_values[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_values[i + 1] = 100.0 - (100.0 / (1.0 + rs))

    return rsi_values


def _atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> np.ndarray:
    """Calculate Average True Range."""
    if len(closes) < period + 1:
        return np.full(len(closes), np.nan)

    # True Range components
    tr = np.empty(len(closes))
    tr[0] = highs[0] - lows[0]

    for i in range(1, len(closes)):
        hl = highs[i] - lows[i]
        hc = abs(highs[i] - closes[i - 1])
        lc = abs(lows[i] - closes[i - 1])
        tr[i] = max(hl, hc, lc)

    # ATR using Wilder's smoothing
    atr_values = np.full(len(closes), np.nan)
    atr_values[period - 1] = np.mean(tr[:period])

    for i in range(period, len(closes)):
        atr_values[i] = (atr_values[i - 1] * (period - 1) + tr[i]) / period

    return atr_values


def _sma(data: np.ndarray, period: int) -> np.ndarray:
    """Calculate Simple Moving Average."""
    if len(data) < period:
        return np.full(len(data), np.nan)

    result = np.full(len(data), np.nan)
    cumsum = np.cumsum(data)
    result[period - 1:] = (cumsum[period - 1:] - np.concatenate([[0], cumsum[:-period]])) / period
    return result


@dataclass
class CandleBuffer:
    """Rolling buffer of candles for a specific symbol/timeframe pair.

    Efficiently manages candle history and computes technical indicators
    on demand. Designed for the scanner engine's hot path.
    """

    symbol: str
    timeframe: str
    max_size: int = DEFAULT_BUFFER_SIZE

    _candles: deque[Candle] = field(default_factory=lambda: deque(maxlen=DEFAULT_BUFFER_SIZE))

    def __post_init__(self):
        # Ensure deque has correct maxlen after dataclass init
        self._candles = deque(maxlen=self.max_size)

    @property
    def size(self) -> int:
        return len(self._candles)

    @property
    def is_ready(self) -> bool:
        """Whether we have enough data for most indicators (>= 30 candles)."""
        return self.size >= 30

    def add_candle(self, candle: Candle) -> None:
        """Add a closed candle to the buffer.

        If the candle's close_time matches the last candle, it updates in-place
        (handles partial → closed candle transition).
        """
        if not candle.is_closed:
            return

        # Deduplicate: if last candle has same open_time, replace it
        if self._candles and self._candles[-1].open_time == candle.open_time:
            self._candles[-1] = candle
        else:
            self._candles.append(candle)

    def _to_arrays(self) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Extract OHLCV arrays from candle buffer."""
        if not self._candles:
            empty = np.array([], dtype=float)
            return empty, empty, empty, empty, empty

        opens = np.array([c.open for c in self._candles], dtype=float)
        highs = np.array([c.high for c in self._candles], dtype=float)
        lows = np.array([c.low for c in self._candles], dtype=float)
        closes = np.array([c.close for c in self._candles], dtype=float)
        volumes = np.array([c.volume for c in self._candles], dtype=float)
        return opens, highs, lows, closes, volumes

    def compute_indicators(
        self,
        ema_fast_period: int = 9,
        ema_slow_period: int = 21,
        ema_signal_period: int = 5,
        rsi_period: int = 14,
        atr_period: int = 14,
        volume_ma_period: int = 20,
    ) -> IndicatorResult:
        """Compute all technical indicators for the current buffer state.

        Returns an IndicatorResult with the latest values. Returns None values
        for indicators where insufficient data exists.
        """
        if self.size < 2:
            return IndicatorResult()

        _, highs, lows, closes, volumes = self._to_arrays()

        result = IndicatorResult(
            current_close=float(closes[-1]),
            current_high=float(highs[-1]),
            current_low=float(lows[-1]),
            current_volume=float(volumes[-1]),
        )

        # EMA calculations
        ema_fast_arr = _ema(closes, ema_fast_period)
        ema_slow_arr = _ema(closes, ema_slow_period)

        if not np.isnan(ema_fast_arr[-1]):
            result.ema_fast = float(ema_fast_arr[-1])
        if not np.isnan(ema_slow_arr[-1]):
            result.ema_slow = float(ema_slow_arr[-1])

        # Previous EMA values for crossover detection
        if len(ema_fast_arr) >= 2 and not np.isnan(ema_fast_arr[-2]):
            result.prev_ema_fast = float(ema_fast_arr[-2])
        if len(ema_slow_arr) >= 2 and not np.isnan(ema_slow_arr[-2]):
            result.prev_ema_slow = float(ema_slow_arr[-2])

        # Signal EMA (EMA of fast EMA)
        if not np.isnan(ema_fast_arr).all():
            valid_ema = ema_fast_arr[~np.isnan(ema_fast_arr)]
            if len(valid_ema) >= ema_signal_period:
                signal_arr = _ema(valid_ema, ema_signal_period)
                if not np.isnan(signal_arr[-1]):
                    result.ema_signal = float(signal_arr[-1])

        # RSI
        rsi_arr = _rsi(closes, rsi_period)
        if not np.isnan(rsi_arr[-1]):
            result.rsi = float(rsi_arr[-1])
        if len(rsi_arr) >= 2 and not np.isnan(rsi_arr[-2]):
            result.prev_rsi = float(rsi_arr[-2])

        # ATR
        atr_arr = _atr(highs, lows, closes, atr_period)
        if not np.isnan(atr_arr[-1]):
            result.atr = float(atr_arr[-1])

        # Volume analysis
        vol_sma_arr = _sma(volumes, volume_ma_period)
        if not np.isnan(vol_sma_arr[-1]):
            result.volume_sma = float(vol_sma_arr[-1])
            if result.volume_sma > 0:
                result.volume_ratio = float(volumes[-1] / result.volume_sma)

        return result

    def get_closes(self, n: int | None = None) -> list[float]:
        """Get the last N close prices."""
        candles = list(self._candles)
        if n is not None:
            candles = candles[-n:]
        return [c.close for c in candles]

    def latest_candle(self) -> Candle | None:
        """Get the most recent candle."""
        return self._candles[-1] if self._candles else None


class CandleBufferManager:
    """Manages multiple CandleBuffer instances keyed by symbol:timeframe.

    Provides a clean interface for the scanner engine to route incoming
    candles to the appropriate buffer.
    """

    def __init__(self, max_buffer_size: int = DEFAULT_BUFFER_SIZE):
        self._buffers: dict[str, CandleBuffer] = {}
        self._max_buffer_size = max_buffer_size

    def _key(self, symbol: str, timeframe: str) -> str:
        return f"{symbol.upper()}:{timeframe}"

    def get_buffer(self, symbol: str, timeframe: str) -> CandleBuffer:
        """Get or create a CandleBuffer for the given symbol/timeframe."""
        key = self._key(symbol, timeframe)
        if key not in self._buffers:
            self._buffers[key] = CandleBuffer(
                symbol=symbol.upper(),
                timeframe=timeframe,
                max_size=self._max_buffer_size,
            )
        return self._buffers[key]

    def add_candle(self, candle: Candle) -> CandleBuffer:
        """Route a candle to its appropriate buffer and return the buffer."""
        buf = self.get_buffer(candle.symbol, candle.timeframe)
        buf.add_candle(candle)
        return buf

    @property
    def buffer_count(self) -> int:
        return len(self._buffers)

    def get_all_buffers(self) -> list[CandleBuffer]:
        """Get all active buffers."""
        return list(self._buffers.values())

    def get_buffer_stats(self) -> dict[str, int]:
        """Get buffer sizes for monitoring."""
        return {key: buf.size for key, buf in self._buffers.items()}
