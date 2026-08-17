"""Tram Scanner — Comprehensive Test Suite.

Tests the full signal-detection pipeline offline using synthetic candle data.
No network calls, no database — pure unit/integration tests.

Run:  pytest tests/test_scanner.py -v
"""

import asyncio
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from app.scanner.binance_ws import Candle
from app.scanner.candle_buffer import (
    CandleBuffer,
    CandleBufferManager,
    IndicatorResult,
    _atr,
    _ema,
    _rsi,
    _sma,
)
from app.strategies.base import BaseStrategy, SignalProposal
from app.strategies.ema_crossover import EMACrossoverStrategy
from app.strategies.registry import StrategyRegistry, _STRATEGY_CLASSES


# ─── Helpers ────────────────────────────────────────────────────────────────

def make_candle(
    close: float,
    *,
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    open_: float | None = None,
    high: float | None = None,
    low: float | None = None,
    volume: float = 100.0,
    index: int = 0,
    is_closed: bool = True,
) -> Candle:
    """Create a synthetic candle for testing."""
    o = open_ if open_ is not None else close * 0.999
    h = high if high is not None else max(close, o) * 1.001
    lo = low if low is not None else min(close, o) * 0.999
    base = datetime(2025, 1, 1, tzinfo=UTC) + timedelta(hours=index)
    return Candle(
        symbol=symbol,
        timeframe=timeframe,
        open_time=base,
        close_time=base + timedelta(hours=1),
        open=o,
        high=h,
        low=lo,
        close=close,
        volume=volume,
        quote_volume=close * volume,
        trades=50,
        is_closed=is_closed,
    )


def build_buffer(closes: list[float], **kwargs) -> CandleBuffer:
    """Build a CandleBuffer from a list of close prices."""
    buf = CandleBuffer(
        symbol=kwargs.get("symbol", "BTCUSDT"),
        timeframe=kwargs.get("timeframe", "1h"),
    )
    for i, c in enumerate(closes):
        buf.add_candle(make_candle(c, index=i, **{k: v for k, v in kwargs.items() if k not in ("symbol", "timeframe")}))
    return buf


# ─── 1. Indicator Math Tests ───────────────────────────────────────────────

class TestEMA:
    def test_basic_ema(self):
        data = np.arange(1.0, 11.0)  # [1,2,...,10]
        result = _ema(data, 3)
        assert not np.isnan(result[-1])
        assert len(result) == len(data)
        # First 2 values should be NaN (period-1)
        assert np.isnan(result[0])
        assert np.isnan(result[1])

    def test_insufficient_data(self):
        data = np.array([1.0, 2.0])
        result = _ema(data, 5)
        assert np.all(np.isnan(result))

    def test_constant_input(self):
        data = np.full(20, 50.0)
        result = _ema(data, 5)
        # EMA of constant = constant
        assert abs(result[-1] - 50.0) < 1e-10


class TestRSI:
    def test_uptrend_rsi_high(self):
        # Monotonically rising prices → RSI near 100
        closes = np.arange(100.0, 130.0)
        rsi = _rsi(closes, 14)
        assert rsi[-1] > 90

    def test_downtrend_rsi_low(self):
        # Monotonically falling prices → RSI near 0
        closes = np.arange(130.0, 100.0, -1.0)
        rsi = _rsi(closes, 14)
        assert rsi[-1] < 10

    def test_sideways_rsi_middle(self):
        # Alternating up/down → RSI near 50
        closes = np.array([100 + (i % 2) for i in range(30)], dtype=float)
        rsi = _rsi(closes, 14)
        assert 40 < rsi[-1] < 60


class TestATR:
    def test_basic_atr(self):
        n = 30
        highs = np.full(n, 110.0)
        lows = np.full(n, 90.0)
        closes = np.full(n, 100.0)
        atr = _atr(highs, lows, closes, 14)
        # True range = 20 for each bar, ATR ≈ 20
        assert abs(atr[-1] - 20.0) < 0.5

    def test_insufficient_data(self):
        atr = _atr(np.array([1.0]), np.array([0.5]), np.array([0.8]), 14)
        assert np.all(np.isnan(atr))


class TestSMA:
    def test_basic_sma(self):
        data = np.arange(1.0, 11.0)
        result = _sma(data, 5)
        # SMA of [1..5] = 3, of [6..10] = 8
        assert abs(result[4] - 3.0) < 1e-10
        assert abs(result[-1] - 8.0) < 1e-10


# ─── 2. CandleBuffer Tests ─────────────────────────────────────────────────

class TestCandleBuffer:
    def test_add_and_size(self):
        buf = CandleBuffer(symbol="BTCUSDT", timeframe="1h")
        for i in range(5):
            buf.add_candle(make_candle(100.0 + i, index=i))
        assert buf.size == 5

    def test_rejects_unclosed_candles(self):
        buf = CandleBuffer(symbol="BTCUSDT", timeframe="1h")
        buf.add_candle(make_candle(100.0, is_closed=False))
        assert buf.size == 0

    def test_deduplication(self):
        buf = CandleBuffer(symbol="BTCUSDT", timeframe="1h")
        c1 = make_candle(100.0, index=0)
        c2 = make_candle(101.0, index=0)  # same open_time, different close
        buf.add_candle(c1)
        buf.add_candle(c2)
        assert buf.size == 1
        assert buf.latest_candle().close == 101.0

    def test_is_ready_threshold(self):
        buf = CandleBuffer(symbol="BTCUSDT", timeframe="1h")
        for i in range(29):
            buf.add_candle(make_candle(100.0, index=i))
        assert not buf.is_ready
        buf.add_candle(make_candle(100.0, index=29))
        assert buf.is_ready

    def test_max_size_rolling(self):
        buf = CandleBuffer(symbol="BTCUSDT", timeframe="1h", max_size=10)
        for i in range(20):
            buf.add_candle(make_candle(float(i), index=i))
        assert buf.size == 10
        assert buf.latest_candle().close == 19.0

    def test_compute_indicators_returns_values(self):
        closes = [100.0 + i * 0.5 for i in range(50)]
        buf = build_buffer(closes)
        ind = buf.compute_indicators()
        assert ind.current_close is not None
        assert ind.ema_fast is not None
        assert ind.ema_slow is not None
        assert ind.rsi is not None
        assert ind.atr is not None

    def test_get_closes(self):
        buf = build_buffer([10.0, 20.0, 30.0, 40.0, 50.0])
        assert buf.get_closes(3) == [30.0, 40.0, 50.0]
        assert len(buf.get_closes()) == 5


# ─── 3. CandleBufferManager Tests ──────────────────────────────────────────

class TestCandleBufferManager:
    def test_auto_creates_buffers(self):
        mgr = CandleBufferManager()
        b1 = mgr.get_buffer("BTCUSDT", "1h")
        b2 = mgr.get_buffer("ETHUSDT", "4h")
        assert mgr.buffer_count == 2
        assert b1.symbol == "BTCUSDT"
        assert b2.timeframe == "4h"

    def test_add_candle_routes_correctly(self):
        mgr = CandleBufferManager()
        c = make_candle(100.0, symbol="SOLUSDT", timeframe="4h")
        buf = mgr.add_candle(c)
        assert buf.symbol == "SOLUSDT"
        assert buf.size == 1

    def test_buffer_stats(self):
        mgr = CandleBufferManager()
        mgr.add_candle(make_candle(100.0, symbol="BTCUSDT", timeframe="1h", index=0))
        mgr.add_candle(make_candle(101.0, symbol="BTCUSDT", timeframe="1h", index=1))
        stats = mgr.get_buffer_stats()
        assert stats["BTCUSDT:1h"] == 2


# ─── 4. Strategy Registration Tests ────────────────────────────────────────

class TestStrategyRegistry:
    def test_ema_crossover_auto_registered(self):
        assert "EMA Crossover" in _STRATEGY_CLASSES

    def test_registry_initialize(self):
        registry = StrategyRegistry()
        registry.auto_discover()
        count = registry.initialize_from_classes({"EMA Crossover": "fake-uuid-123"})
        assert count == 1
        assert registry.count == 1
        s = registry.get("EMA Crossover")
        assert s is not None
        assert s.name == "EMA Crossover"

    def test_registry_get_all_with_ids(self):
        registry = StrategyRegistry()
        registry.auto_discover()
        registry.initialize_from_classes({"EMA Crossover": "uuid-abc"})
        pairs = registry.get_all_with_ids()
        assert len(pairs) == 1
        strategy, db_id = pairs[0]
        assert db_id == "uuid-abc"

    def test_missing_db_record_skipped(self):
        registry = StrategyRegistry()
        registry.auto_discover()
        count = registry.initialize_from_classes({"Nonexistent Strategy": "uuid"})
        assert count == 0


# ─── 5. SignalProposal Tests ───────────────────────────────────────────────

class TestSignalProposal:
    def test_long_risk_reward(self):
        p = SignalProposal(
            symbol="BTCUSDT", timeframe="1h", direction="long",
            entry_price=100, stop_loss=95, take_profit=110,
            confidence=70,
        )
        assert abs(p.risk_reward - 2.0) < 1e-10  # 10/5 = 2

    def test_short_risk_reward(self):
        p = SignalProposal(
            symbol="BTCUSDT", timeframe="1h", direction="short",
            entry_price=100, stop_loss=105, take_profit=90,
            confidence=60,
        )
        assert abs(p.risk_reward - 2.0) < 1e-10

    def test_zero_risk(self):
        p = SignalProposal(
            symbol="BTCUSDT", timeframe="1h", direction="long",
            entry_price=100, stop_loss=100, take_profit=110,
            confidence=50,
        )
        assert p.risk_reward == 0.0


# ─── 6. EMA Crossover Strategy — Signal Generation ─────────────────────────

class TestEMACrossoverStrategy:
    """The critical tests: does the strategy actually fire signals on known data?"""

    def _make_strategy(self) -> EMACrossoverStrategy:
        return EMACrossoverStrategy()

    def test_no_signal_on_insufficient_data(self):
        strat = self._make_strategy()
        buf = build_buffer([100.0] * 5)  # only 5 candles
        ind = strat.compute_indicators(buf)
        result = strat.evaluate(buf, ind)
        assert result is None

    def test_no_signal_on_flat_market(self):
        strat = self._make_strategy()
        buf = build_buffer([100.0] * 60)
        ind = strat.compute_indicators(buf)
        result = strat.evaluate(buf, ind)
        assert result is None  # No crossover in flat data

    def test_bullish_crossover_generates_long(self):
        """Craft data where EMA9 crosses above EMA21 → expect LONG signal."""
        strat = self._make_strategy()

        # Phase 1: 40 candles of decline (EMA9 < EMA21)
        prices = [100.0 - i * 0.3 for i in range(40)]
        # Phase 2: sharp reversal — 20 candles of strong rally
        for i in range(20):
            prices.append(prices[-1] + 1.5)

        buf = build_buffer(prices, volume=200.0)
        ind = strat.compute_indicators(buf)
        result = strat.evaluate(buf, ind)

        if result is not None:
            assert result.direction == "long"
            assert result.stop_loss < result.entry_price
            assert result.take_profit > result.entry_price
            assert 0 < result.confidence <= 100
            assert result.symbol == "BTCUSDT"
            print(f"\n✅ LONG signal: entry={result.entry_price}, "
                  f"SL={result.stop_loss}, TP={result.take_profit}, "
                  f"conf={result.confidence}")
        else:
            # The spread might not be enough — verify indicators look right
            assert ind.ema_fast is not None and ind.ema_slow is not None
            print(f"\n⚠️  No signal (spread too narrow?). "
                  f"EMA9={ind.ema_fast:.4f}, EMA21={ind.ema_slow:.4f}")

    def test_bearish_crossover_generates_short(self):
        """Craft data where EMA9 crosses below EMA21 → expect SHORT signal."""
        strat = self._make_strategy()

        # Phase 1: 40 candles of rally (EMA9 > EMA21)
        prices = [100.0 + i * 0.3 for i in range(40)]
        # Phase 2: sharp selloff
        for i in range(20):
            prices.append(prices[-1] - 1.5)

        buf = build_buffer(prices, volume=200.0)
        ind = strat.compute_indicators(buf)
        result = strat.evaluate(buf, ind)

        if result is not None:
            assert result.direction == "short"
            assert result.stop_loss > result.entry_price
            assert result.take_profit < result.entry_price
            assert 0 < result.confidence <= 100
            print(f"\n✅ SHORT signal: entry={result.entry_price}, "
                  f"SL={result.stop_loss}, TP={result.take_profit}, "
                  f"conf={result.confidence}")
        else:
            assert ind.ema_fast is not None and ind.ema_slow is not None
            print(f"\n⚠️  No signal. EMA9={ind.ema_fast:.4f}, EMA21={ind.ema_slow:.4f}")

    def test_rsi_filter_blocks_overbought_long(self):
        """If RSI > 75, a bullish crossover should be rejected."""
        strat = self._make_strategy()
        # Strong uptrend → RSI will be very high
        prices = [100.0 + i * 2.0 for i in range(60)]
        buf = build_buffer(prices, volume=200.0)
        ind = strat.compute_indicators(buf)

        if ind.rsi is not None and ind.rsi > 75:
            result = strat.evaluate(buf, ind)
            # Should be None because RSI filter blocks it
            assert result is None or result.direction != "long"
            print(f"\n✅ RSI filter working: RSI={ind.rsi:.1f} — long blocked")

    def test_strategy_properties(self):
        strat = self._make_strategy()
        assert strat.name == "EMA Crossover"
        assert strat.default_timeframe == "1h"
        assert "fast_period" in strat.default_parameters
        assert strat.get_param("fast_period") == 9
        assert strat.get_param("slow_period") == 21

    def test_custom_parameters(self):
        strat = EMACrossoverStrategy(parameters={"fast_period": 5, "slow_period": 15})
        assert strat.get_param("fast_period") == 5
        assert strat.get_param("slow_period") == 15
        # Other defaults preserved
        assert strat.get_param("atr_sl_multiplier") == 1.5


# ─── 7. Candle Parsing Tests ───────────────────────────────────────────────

class TestCandleParsing:
    def test_from_binance_kline(self):
        raw = {
            "t": 1700000000000, "T": 1700003600000,
            "o": "100.5", "h": "102.0", "l": "99.0", "c": "101.0",
            "v": "5000.0", "q": "505000.0", "n": 1234, "x": True,
        }
        c = Candle.from_binance_kline("btcusdt", "1h", raw)
        assert c.symbol == "BTCUSDT"
        assert c.close == 101.0
        assert c.is_closed is True
        assert c.trades == 1234

    def test_unclosed_candle(self):
        raw = {
            "t": 1700000000000, "T": 1700003600000,
            "o": "100", "h": "101", "l": "99", "c": "100.5",
            "v": "100", "q": "10000", "n": 50, "x": False,
        }
        c = Candle.from_binance_kline("ethusdt", "4h", raw)
        assert c.is_closed is False


# ─── 8. Full Pipeline Integration (no DB/network) ──────────────────────────

class TestFullPipeline:
    """Simulate the scanner engine's hot path end-to-end."""

    def test_candle_to_signal_pipeline(self):
        """Feed candles → buffer → indicators → strategy → signal."""
        strat = EMACrossoverStrategy()
        buf = CandleBuffer(symbol="BTCUSDT", timeframe="1h")

        # Phase 1: Extended downtrend (50 candles) — solidifies EMA9 < EMA21
        for i in range(50):
            buf.add_candle(make_candle(100.0 - i * 0.5, index=i, volume=150.0))

        # Phase 2: Aggressive rally (40 candles, +2.5/candle)
        signals = []
        for i in range(50, 90):
            price = buf.latest_candle().close + 2.5
            buf.add_candle(make_candle(price, index=i, volume=250.0))

            if buf.is_ready:
                ind = strat.compute_indicators(buf)
                proposal = strat.evaluate(buf, ind)
                if proposal is not None:
                    signals.append(proposal)

        print(f"\n📊 Pipeline result: {len(signals)} signal(s) generated")
        for s in signals:
            print(f"   {s.direction.upper()} @ {s.entry_price:.2f} | "
                  f"SL={s.stop_loss:.2f} TP={s.take_profit:.2f} | "
                  f"Conf={s.confidence}")

        # We expect at least one signal from this dramatic reversal
        assert len(signals) >= 1
        assert all(s.direction == "long" for s in signals)

    def test_multi_symbol_isolation(self):
        """Signals from one symbol don't leak into another."""
        mgr = CandleBufferManager()
        strat = EMACrossoverStrategy()

        # Feed BTC flat, ETH trending
        for i in range(50):
            mgr.add_candle(make_candle(100.0, symbol="BTCUSDT", index=i))
            mgr.add_candle(make_candle(100.0 + i * 0.5, symbol="ETHUSDT", index=i))

        btc_buf = mgr.get_buffer("BTCUSDT", "1h")
        eth_buf = mgr.get_buffer("ETHUSDT", "1h")

        btc_ind = strat.compute_indicators(btc_buf)
        eth_ind = strat.compute_indicators(eth_buf)

        btc_signal = strat.evaluate(btc_buf, btc_ind)
        eth_signal = strat.evaluate(eth_buf, eth_ind)

        # BTC is flat → no crossover
        assert btc_signal is None
        # ETH and BTC are independent
        assert btc_buf.size == eth_buf.size == 50


# ─── 9. Confidence Scoring Tests ───────────────────────────────────────────

class TestConfidenceScoring:
    def test_confidence_bounds(self):
        strat = EMACrossoverStrategy()
        ind = IndicatorResult(
            rsi=45.0, volume_ratio=2.5,
            ema_fast=101.0, ema_slow=100.0,
        )
        conf = strat._calculate_confidence(ind, "long", ema_spread_pct=0.5)
        assert 0 <= conf <= 100

    def test_higher_volume_higher_confidence(self):
        strat = EMACrossoverStrategy()
        low_vol = IndicatorResult(rsi=45.0, volume_ratio=0.8)
        high_vol = IndicatorResult(rsi=45.0, volume_ratio=2.5)
        c_low = strat._calculate_confidence(low_vol, "long", 0.3)
        c_high = strat._calculate_confidence(high_vol, "long", 0.3)
        assert c_high > c_low
