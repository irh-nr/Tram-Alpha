"""Tram Backend - Volume Breakout Strategy.

Detects price breakouts from consolidation ranges confirmed by
significant volume spikes. Identifies when price compresses into
a tight range and then breaks out with above-average volume.

Signal logic:
    1. CONSOLIDATION: Recent candles show a tight price range
       (range width < threshold % of average price)
    2. BREAKOUT: Current candle closes above/below the range boundary
    3. VOLUME SPIKE: Current volume > N × average volume

    LONG: Close > range high + volume spike
    SHORT: Close < range low + volume spike

Stop Loss: Entry ± (ATR × multiplier)
Take Profit: Entry ± (ATR × multiplier × risk_reward_target)
"""

from typing import Any

import numpy as np

from app.scanner.candle_buffer import CandleBuffer, IndicatorResult, _atr, _sma
from app.strategies.base import BaseStrategy, SignalProposal
from app.strategies.registry import register_strategy


@register_strategy
class VolumeBreakoutStrategy(BaseStrategy):
    """Volume Breakout strategy — catches explosive moves out of consolidation."""

    @property
    def name(self) -> str:
        return "Volume Breakout"

    @property
    def description(self) -> str:
        return "Detects breakouts from consolidation zones confirmed by volume spikes"

    @property
    def default_timeframe(self) -> str:
        return "1h"

    @property
    def default_parameters(self) -> dict[str, Any]:
        return {
            "consolidation_period": 15,       # Candles to check for consolidation
            "range_threshold_pct": 3.0,        # Max range width % for consolidation
            "volume_multiplier": 2.0,          # Required volume > N × average
            "volume_ma_period": 20,            # Period for average volume calculation
            "atr_period": 14,
            "atr_sl_multiplier": 1.5,          # ATR × this = stop loss distance
            "risk_reward_target": 2.0,         # R:R target for take profit
            "min_body_pct": 50.0,              # Min candle body % of total range (strong close)
        }

    def compute_indicators(self, buffer: CandleBuffer) -> IndicatorResult:
        """Compute indicators with strategy-specific parameters."""
        return buffer.compute_indicators(
            atr_period=self.get_param("atr_period"),
            volume_ma_period=self.get_param("volume_ma_period"),
        )

    def evaluate(
        self,
        buffer: CandleBuffer,
        indicators: IndicatorResult,
    ) -> SignalProposal | None:
        """Check for volume breakout conditions."""
        consolidation_period = self.get_param("consolidation_period")

        # Need enough candles for consolidation analysis
        if buffer.size < consolidation_period + 5:
            return None

        if (
            indicators.atr is None
            or indicators.current_close is None
            or indicators.current_high is None
            or indicators.current_low is None
            or indicators.volume_ratio is None
        ):
            return None

        # Get raw OHLCV data
        _, highs, lows, closes, volumes = buffer._to_arrays()

        # Step 1: Detect consolidation in the preceding candles
        # (exclude the current breakout candle)
        consol_highs = highs[-(consolidation_period + 1):-1]
        consol_lows = lows[-(consolidation_period + 1):-1]

        range_high = float(np.max(consol_highs))
        range_low = float(np.min(consol_lows))
        range_width = range_high - range_low
        range_mid = (range_high + range_low) / 2

        # Range width as percentage of mid price
        range_pct = (range_width / range_mid * 100) if range_mid > 0 else 999

        threshold = self.get_param("range_threshold_pct")
        if range_pct > threshold:
            return None  # Not consolidated enough

        # Step 2: Detect breakout — current candle closes outside the range
        close = indicators.current_close
        high = indicators.current_high
        low = indicators.current_low

        bullish_breakout = close > range_high
        bearish_breakout = close < range_low

        if not bullish_breakout and not bearish_breakout:
            return None

        # Step 3: Volume confirmation — current volume above threshold
        volume_multiplier = self.get_param("volume_multiplier")
        if indicators.volume_ratio < volume_multiplier:
            return None  # Insufficient volume for breakout

        # Step 4: Candle body strength — filter out wicks-only breakouts
        candle_range = high - low
        if candle_range > 0:
            if bullish_breakout:
                body = close - float(closes[-2]) if close > float(closes[-2]) else 0
            else:
                body = float(closes[-2]) - close if close < float(closes[-2]) else 0

            body_pct = (body / candle_range * 100)
            if body_pct < self.get_param("min_body_pct"):
                return None  # Weak body — likely false breakout

        direction = "long" if bullish_breakout else "short"

        # Calculate levels
        atr = indicators.atr
        sl_distance = atr * self.get_param("atr_sl_multiplier")
        tp_distance = sl_distance * self.get_param("risk_reward_target")

        if direction == "long":
            entry = close
            stop_loss = max(entry - sl_distance, range_low)  # SL at range low minimum
            take_profit = entry + tp_distance
        else:
            entry = close
            stop_loss = min(entry + sl_distance, range_high)  # SL at range high max
            take_profit = entry - tp_distance

        # Confidence scoring
        confidence = self._calculate_confidence(
            direction, range_pct, threshold, indicators.volume_ratio,
            volume_multiplier, close, range_high, range_low, atr
        )

        return SignalProposal(
            symbol=buffer.symbol,
            timeframe=buffer.timeframe,
            direction=direction,
            entry_price=round(entry, 8),
            stop_loss=round(stop_loss, 8),
            take_profit=round(take_profit, 8),
            confidence=round(confidence, 1),
            metadata={
                "strategy": self.name,
                "breakout_type": "bullish" if bullish_breakout else "bearish",
                "range_high": round(range_high, 8),
                "range_low": round(range_low, 8),
                "range_pct": round(range_pct, 4),
                "volume_ratio": round(indicators.volume_ratio, 2),
                "atr": round(atr, 8),
                "consolidation_candles": consolidation_period,
            },
        )

    def _calculate_confidence(
        self,
        direction: str,
        range_pct: float,
        threshold: float,
        volume_ratio: float,
        volume_multiplier: float,
        close: float,
        range_high: float,
        range_low: float,
        atr: float,
    ) -> float:
        """Calculate confidence score for volume breakout signal.

        Scoring breakdown:
            - Base breakout: 20 points
            - Consolidation tightness: 0-25 points (tighter = stronger)
            - Volume expansion: 0-30 points
            - Breakout magnitude: 0-25 points
        """
        score = 20.0  # Base score for valid breakout

        # Consolidation tightness (tighter range = more explosive breakout)
        tightness = 1.0 - (range_pct / threshold)  # 0-1 scale
        score += tightness * 25

        # Volume expansion (stronger volume = more conviction)
        vol_excess = volume_ratio / volume_multiplier  # 1.0 = minimum
        if vol_excess >= 3.0:
            score += 30
        elif vol_excess >= 2.0:
            score += 25
        elif vol_excess >= 1.5:
            score += 18
        else:
            score += 10

        # Breakout magnitude (how far past the range boundary)
        if direction == "long":
            breakout_distance = close - range_high
        else:
            breakout_distance = range_low - close

        if atr > 0:
            breakout_atrs = breakout_distance / atr
            if breakout_atrs >= 1.0:
                score += 25
            elif breakout_atrs >= 0.5:
                score += 18
            elif breakout_atrs >= 0.2:
                score += 10
            else:
                score += 5

        return min(score, 100)
