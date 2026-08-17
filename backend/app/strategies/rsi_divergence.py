"""Tram Backend - RSI Divergence Strategy.

Detects bullish and bearish RSI divergences — when price and RSI
move in opposite directions, signaling potential trend reversals.

Signal logic:
    BULLISH divergence:
        - Price makes a lower low
        - RSI makes a higher low
        → Suggests downtrend weakening, potential reversal up

    BEARISH divergence:
        - Price makes a higher high
        - RSI makes a lower high
        → Suggests uptrend weakening, potential reversal down

Stop Loss: Entry ± (ATR × multiplier)
Take Profit: Entry ± (ATR × multiplier × risk_reward_target)
"""

from typing import Any

import numpy as np

from app.scanner.candle_buffer import CandleBuffer, IndicatorResult, _rsi, _atr
from app.strategies.base import BaseStrategy, SignalProposal
from app.strategies.registry import register_strategy


@register_strategy
class RSIDivergenceStrategy(BaseStrategy):
    """RSI Divergence strategy — catches trend reversals via price/RSI divergence."""

    @property
    def name(self) -> str:
        return "RSI Divergence"

    @property
    def description(self) -> str:
        return "Detects bullish/bearish divergence between price and RSI for reversal signals"

    @property
    def default_timeframe(self) -> str:
        return "4h"

    @property
    def default_parameters(self) -> dict[str, Any]:
        return {
            "rsi_period": 14,
            "divergence_lookback": 10,      # Number of candles to scan for pivots
            "oversold_threshold": 35,        # RSI below this for bullish divergence
            "overbought_threshold": 65,      # RSI above this for bearish divergence
            "atr_period": 14,
            "atr_sl_multiplier": 2.0,        # Wider stops for reversal trades
            "risk_reward_target": 2.5,       # Target R:R for take profit
            "min_price_move_pct": 0.3,       # Minimum price move % between pivots
            "min_rsi_divergence": 3.0,       # Minimum RSI points of divergence
        }

    def compute_indicators(self, buffer: CandleBuffer) -> IndicatorResult:
        """Compute indicators with strategy-specific parameters."""
        return buffer.compute_indicators(
            rsi_period=self.get_param("rsi_period"),
            atr_period=self.get_param("atr_period"),
        )

    def evaluate(
        self,
        buffer: CandleBuffer,
        indicators: IndicatorResult,
    ) -> SignalProposal | None:
        """Check for RSI divergence conditions."""
        lookback = self.get_param("divergence_lookback")

        # Need enough candles for divergence detection
        if buffer.size < lookback + 5:
            return None

        if indicators.atr is None or indicators.current_close is None:
            return None

        # Get raw close prices and RSI array for pivot detection
        _, highs, lows, closes, volumes = buffer._to_arrays()
        rsi_arr = _rsi(closes, self.get_param("rsi_period"))

        # Need valid RSI values in the lookback window
        lookback_rsi = rsi_arr[-lookback:]
        if np.any(np.isnan(lookback_rsi)):
            return None

        lookback_closes = closes[-lookback:]
        lookback_lows = lows[-lookback:]
        lookback_highs = highs[-lookback:]

        # Detect bullish divergence: price lower low, RSI higher low
        bullish = self._detect_bullish_divergence(
            lookback_lows, lookback_closes, lookback_rsi
        )

        # Detect bearish divergence: price higher high, RSI lower high
        bearish = self._detect_bearish_divergence(
            lookback_highs, lookback_closes, lookback_rsi
        )

        if not bullish and not bearish:
            return None

        direction = "long" if bullish else "short"
        close = indicators.current_close
        atr = indicators.atr

        # RSI zone confirmation
        rsi_current = float(rsi_arr[-1])
        if direction == "long" and rsi_current > self.get_param("oversold_threshold"):
            # For bullish divergence, RSI should be in oversold territory
            pass  # Allow but reduce confidence
        if direction == "short" and rsi_current < self.get_param("overbought_threshold"):
            pass  # Allow but reduce confidence

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

        # Confidence scoring
        confidence = self._calculate_confidence(
            direction, rsi_current, lookback_closes, lookback_rsi,
            indicators.volume_ratio
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
                "divergence_type": "bullish" if bullish else "bearish",
                "rsi": round(rsi_current, 2),
                "atr": round(atr, 8),
                "volume_ratio": round(indicators.volume_ratio, 2) if indicators.volume_ratio else None,
            },
        )

    def _detect_bullish_divergence(
        self,
        lows: np.ndarray,
        closes: np.ndarray,
        rsi: np.ndarray,
    ) -> bool:
        """Detect bullish divergence: price lower low + RSI higher low.

        Looks for two swing lows where:
        1. The recent swing low is lower than the previous one (price)
        2. The RSI at the recent swing low is higher than at the previous one
        """
        min_price_move = self.get_param("min_price_move_pct") / 100
        min_rsi_div = self.get_param("min_rsi_divergence")

        # Find swing lows (local minima) in the lookback window
        swing_lows = self._find_swing_lows(lows)

        if len(swing_lows) < 2:
            return False

        # Compare the two most recent swing lows
        prev_idx, curr_idx = swing_lows[-2], swing_lows[-1]

        # Price must make a lower low
        price_lower = lows[curr_idx] < lows[prev_idx]
        price_move = abs(lows[curr_idx] - lows[prev_idx]) / lows[prev_idx]

        if not price_lower or price_move < min_price_move:
            return False

        # RSI must make a higher low (divergence)
        rsi_higher = rsi[curr_idx] > rsi[prev_idx]
        rsi_diff = rsi[curr_idx] - rsi[prev_idx]

        if not rsi_higher or rsi_diff < min_rsi_div:
            return False

        # The current candle should be near the recent swing low
        # (within 2 candles of the current swing low)
        if curr_idx < len(lows) - 3:
            return False

        return True

    def _detect_bearish_divergence(
        self,
        highs: np.ndarray,
        closes: np.ndarray,
        rsi: np.ndarray,
    ) -> bool:
        """Detect bearish divergence: price higher high + RSI lower high."""
        min_price_move = self.get_param("min_price_move_pct") / 100
        min_rsi_div = self.get_param("min_rsi_divergence")

        # Find swing highs (local maxima)
        swing_highs = self._find_swing_highs(highs)

        if len(swing_highs) < 2:
            return False

        prev_idx, curr_idx = swing_highs[-2], swing_highs[-1]

        # Price must make a higher high
        price_higher = highs[curr_idx] > highs[prev_idx]
        price_move = abs(highs[curr_idx] - highs[prev_idx]) / highs[prev_idx]

        if not price_higher or price_move < min_price_move:
            return False

        # RSI must make a lower high (divergence)
        rsi_lower = rsi[curr_idx] < rsi[prev_idx]
        rsi_diff = rsi[prev_idx] - rsi[curr_idx]

        if not rsi_lower or rsi_diff < min_rsi_div:
            return False

        if curr_idx < len(highs) - 3:
            return False

        return True

    def _find_swing_lows(self, data: np.ndarray) -> list[int]:
        """Find indices of swing lows (local minima) in the data.

        A swing low is a point lower than both its neighbors.
        """
        swings = []
        for i in range(1, len(data) - 1):
            if data[i] < data[i - 1] and data[i] <= data[i + 1]:
                swings.append(i)
        return swings

    def _find_swing_highs(self, data: np.ndarray) -> list[int]:
        """Find indices of swing highs (local maxima) in the data."""
        swings = []
        for i in range(1, len(data) - 1):
            if data[i] > data[i - 1] and data[i] >= data[i + 1]:
                swings.append(i)
        return swings

    def _calculate_confidence(
        self,
        direction: str,
        rsi: float,
        closes: np.ndarray,
        rsi_arr: np.ndarray,
        volume_ratio: float | None,
    ) -> float:
        """Calculate confidence score for RSI divergence signal.

        Scoring breakdown:
            - Base divergence detection: 25 points
            - RSI zone (oversold/overbought): 0-25 points
            - Divergence strength: 0-25 points
            - Volume confirmation: 0-25 points
        """
        score = 25.0  # Base score for valid divergence

        # RSI zone scoring
        if direction == "long":
            if rsi <= 25:
                score += 25  # Deeply oversold — strong signal
            elif rsi <= 30:
                score += 20
            elif rsi <= self.get_param("oversold_threshold"):
                score += 15
            else:
                score += 5  # RSI not in ideal zone
        else:
            if rsi >= 75:
                score += 25
            elif rsi >= 70:
                score += 20
            elif rsi >= self.get_param("overbought_threshold"):
                score += 15
            else:
                score += 5

        # Divergence strength (RSI range in lookback)
        rsi_range = float(np.max(rsi_arr) - np.min(rsi_arr))
        if rsi_range >= 30:
            score += 25
        elif rsi_range >= 20:
            score += 18
        elif rsi_range >= 10:
            score += 10
        else:
            score += 3

        # Volume confirmation
        if volume_ratio is not None:
            if volume_ratio >= 1.5:
                score += 25
            elif volume_ratio >= 1.2:
                score += 18
            elif volume_ratio >= 1.0:
                score += 12
            elif volume_ratio >= 0.8:
                score += 5

        return min(score, 100)
