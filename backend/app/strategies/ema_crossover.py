"""Tram Backend - EMA Crossover Strategy.

Detects when the fast EMA crosses the slow EMA, signaling potential
trend direction changes. Uses ATR for dynamic stop-loss and take-profit
placement.

Signal logic:
    - LONG: fast EMA crosses above slow EMA (bullish crossover)
    - SHORT: fast EMA crosses below slow EMA (bearish crossover)
    - Confidence based on EMA spread, RSI confirmation, and volume

Stop Loss: Entry ± (ATR × multiplier)
Take Profit: Entry ± (ATR × multiplier × risk_reward_target)
"""

from typing import Any

from app.scanner.candle_buffer import CandleBuffer, IndicatorResult
from app.strategies.base import BaseStrategy, SignalProposal
from app.strategies.registry import register_strategy


@register_strategy
class EMACrossoverStrategy(BaseStrategy):
    """EMA Crossover strategy — the bread-and-butter trend-following strategy."""

    @property
    def name(self) -> str:
        return "EMA Crossover"

    @property
    def description(self) -> str:
        return "Detects when fast EMA crosses slow EMA, signaling trend direction change"

    @property
    def default_timeframe(self) -> str:
        return "1h"

    @property
    def default_parameters(self) -> dict[str, Any]:
        return {
            "fast_period": 9,
            "slow_period": 21,
            "signal_period": 5,
            "atr_period": 14,
            "atr_sl_multiplier": 1.5,      # ATR × this = stop loss distance
            "risk_reward_target": 2.0,       # R:R target for take profit
            "min_ema_spread_pct": 0.05,      # Minimum EMA spread % to confirm
            "rsi_long_max": 75,              # RSI must be below this for long
            "rsi_short_min": 25,             # RSI must be above this for short
            "volume_min_ratio": 0.8,         # Minimum volume ratio vs SMA
        }

    def compute_indicators(self, buffer: CandleBuffer) -> IndicatorResult:
        """Compute indicators with strategy-specific parameters."""
        return buffer.compute_indicators(
            ema_fast_period=self.get_param("fast_period"),
            ema_slow_period=self.get_param("slow_period"),
            ema_signal_period=self.get_param("signal_period"),
            rsi_period=14,
            atr_period=self.get_param("atr_period"),
            volume_ma_period=20,
        )

    def evaluate(
        self,
        buffer: CandleBuffer,
        indicators: IndicatorResult,
    ) -> SignalProposal | None:
        """Check for EMA crossover conditions."""
        # Need current and previous EMA values for crossover detection
        if (
            indicators.ema_fast is None
            or indicators.ema_slow is None
            or indicators.prev_ema_fast is None
            or indicators.prev_ema_slow is None
            or indicators.atr is None
            or indicators.current_close is None
        ):
            return None

        ema_fast = indicators.ema_fast
        ema_slow = indicators.ema_slow
        prev_fast = indicators.prev_ema_fast
        prev_slow = indicators.prev_ema_slow
        atr = indicators.atr
        close = indicators.current_close

        # Detect crossover
        bullish_cross = prev_fast <= prev_slow and ema_fast > ema_slow
        bearish_cross = prev_fast >= prev_slow and ema_fast < ema_slow

        if not bullish_cross and not bearish_cross:
            return None

        direction = "long" if bullish_cross else "short"

        # Confirm with EMA spread — reject weak crosses
        ema_spread_pct = abs(ema_fast - ema_slow) / ema_slow * 100
        min_spread = self.get_param("min_ema_spread_pct")
        if ema_spread_pct < min_spread:
            return None

        # RSI confirmation — avoid overbought longs / oversold shorts
        if indicators.rsi is not None:
            if direction == "long" and indicators.rsi > self.get_param("rsi_long_max"):
                return None
            if direction == "short" and indicators.rsi < self.get_param("rsi_short_min"):
                return None

        # Volume confirmation — reject low-volume crosses
        if indicators.volume_ratio is not None:
            if indicators.volume_ratio < self.get_param("volume_min_ratio"):
                return None

        # Calculate levels
        sl_distance = atr * self.get_param("atr_sl_multiplier")
        tp_distance = sl_distance * self.get_param("risk_reward_target")

        if direction == "long":
            entry = close
            stop_loss = entry - sl_distance
            take_profit = entry + tp_distance
        else:
            entry = close
            stop_loss = entry + sl_distance
            take_profit = entry - tp_distance

        # Confidence scoring (0-100)
        confidence = self._calculate_confidence(indicators, direction, ema_spread_pct)

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
                "ema_fast": round(ema_fast, 8),
                "ema_slow": round(ema_slow, 8),
                "ema_spread_pct": round(ema_spread_pct, 4),
                "rsi": round(indicators.rsi, 2) if indicators.rsi else None,
                "atr": round(atr, 8),
                "volume_ratio": round(indicators.volume_ratio, 2) if indicators.volume_ratio else None,
            },
        )

    def _calculate_confidence(
        self,
        indicators: IndicatorResult,
        direction: str,
        ema_spread_pct: float,
    ) -> float:
        """Calculate confidence score based on multiple factors.

        Scoring breakdown:
            - EMA spread strength: 0-30 points
            - RSI confirmation: 0-25 points
            - Volume strength: 0-25 points
            - Base crossover: 20 points
        """
        score = 20.0  # Base score for a valid crossover

        # EMA spread strength (stronger spread = higher confidence)
        spread_score = min(ema_spread_pct * 100, 30)
        score += spread_score

        # RSI confirmation
        if indicators.rsi is not None:
            if direction == "long":
                # RSI 30-50 is ideal for long (oversold recovery)
                if 30 <= indicators.rsi <= 50:
                    score += 25
                elif 50 < indicators.rsi <= 65:
                    score += 15
                else:
                    score += 5
            else:
                # RSI 50-70 is ideal for short (overbought reversal)
                if 50 <= indicators.rsi <= 70:
                    score += 25
                elif 35 <= indicators.rsi < 50:
                    score += 15
                else:
                    score += 5

        # Volume confirmation
        if indicators.volume_ratio is not None:
            if indicators.volume_ratio >= 2.0:
                score += 25  # Strong volume spike
            elif indicators.volume_ratio >= 1.5:
                score += 20
            elif indicators.volume_ratio >= 1.0:
                score += 15
            elif indicators.volume_ratio >= 0.8:
                score += 8

        return min(score, 100)
