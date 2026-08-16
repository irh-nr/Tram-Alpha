"""Tram Backend - Scanner Engine.

The main loop that orchestrates the signal detection pipeline:
    1. Receives candles from BinanceWSClient
    2. Routes them to CandleBufferManager
    3. Runs all registered strategies on each closed candle
    4. Persists valid signals to Supabase

Runs as an async task alongside the FastAPI server or as a
standalone worker process.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.core.logging import get_logger
from app.db.client import get_supabase_client
from app.scanner.binance_ws import BinanceWSClient, Candle, fetch_historical_klines
from app.scanner.candle_buffer import CandleBufferManager
from app.strategies.base import SignalProposal
from app.strategies.registry import StrategyRegistry
from app.services.notification_service import get_notification_service

logger = get_logger(__name__)

# Default symbols to scan
# DEFAULT_SYMBOLS = [
    #"BTCUSDT",
    #"ETHUSDT",
    #"SOLUSDT",
    #"BNBUSDT",
    #"XRPUSDT",
    #"ADAUSDT",
    #"DOGEUSDT",
    #"AVAXUSDT",
    #"DOTUSDT",
    #"MATICUSDT", # Default

#]

# Default symbols to scan (Curated for 1h/4h Trend Following)
DEFAULT_SYMBOLS = [
    # Majors / Blue Chips (Arah tren paling stabil)
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    
    # High-Activity Layer 1 & 2 (Pergerakan impulsif yang bagus untuk EMA)
    "TONUSDT",
    "SUIUSDT",
    "APTUSDT",
    "NEARUSDT",
    "AVAXUSDT",
    
    # AI & DePIN Narrative (Sering membentuk tren panjang berhari-hari)
    "RNDRUSDT",
    "FETUSDT",
    "ARUSDT",
    
    # Meme Coins (Volatilitas ekstrem, EMA crossover sering kali sangat valid)
    "PEPEUSDT",
    "WIFUSDT",
    "DOGEUSDT",
    "FLOKIUSDT",
    
    # RWA, DeFi & Oracles (Fundamental solid, pergerakan teknikal rapi)
    "ONDOUSDT",
    "LINKUSDT",
    "PENDLEUSDT",
    "INJUSDT",
]

DEFAULT_TIMEFRAMES = ["1h", "4h"]

# Minimum interval between signals for same symbol/strategy (prevent spam)
SIGNAL_COOLDOWN = timedelta(hours=4)


@dataclass
class ScannerStats:
    """Runtime statistics for the scanner engine."""

    candles_processed: int = 0
    signals_generated: int = 0
    signals_persisted: int = 0
    errors: int = 0
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def uptime_seconds(self) -> float:
        return (datetime.now(UTC) - self.started_at).total_seconds()


class ScannerEngine:
    """Main scanner engine — the heart of the signal detection pipeline.

    Usage:
        engine = ScannerEngine(
            symbols=["BTCUSDT", "ETHUSDT"],
            timeframes=["1h", "4h"],
        )
        await engine.initialize()  # Load strategies from DB
        await engine.start()       # Runs until cancelled
    """

    def __init__(
        self,
        symbols: list[str] | None = None,
        timeframes: list[str] | None = None,
    ):
        self.symbols = symbols or DEFAULT_SYMBOLS
        self.timeframes = timeframes or DEFAULT_TIMEFRAMES

        self.buffer_manager = CandleBufferManager()
        self.registry = StrategyRegistry()
        self.stats = ScannerStats()

        # Cooldown tracking: (symbol, strategy_name) -> last_signal_time
        self._cooldowns: dict[tuple[str, str], datetime] = {}

        self._ws_client: BinanceWSClient | None = None
        self._running = False

    async def initialize(self) -> None:
        """Initialize the scanner: discover strategies, load DB IDs, backfill buffers."""
        logger.info("scanner_initializing")

        # Auto-discover strategy classes
        self.registry.auto_discover()

        # Fetch strategy records from DB to get UUIDs
        try:
            client = await get_supabase_client()
            result = await (
                client.from_("strategies")
                .select("id, name")
                .eq("is_system", True)
                .eq("is_active", True)
                .execute()
            )

            strategy_db_map = {row["name"]: row["id"] for row in result.data}
            count = self.registry.initialize_from_classes(strategy_db_map)

            logger.info(
                "scanner_strategies_loaded",
                registered=count,
                db_strategies=list(strategy_db_map.keys()),
            )
        except Exception as e:
            logger.error("scanner_strategy_load_error", error=str(e))
            raise

        # Backfill historical candles so buffers are immediately ready
        await self._backfill_buffers()

    async def _backfill_buffers(self) -> None:
        """Fetch historical candles from Binance REST API to pre-fill buffers.

        This eliminates the cold-start problem where buffers need 30+ hours
        of live data before strategies can evaluate.
        """
        total_candles = 0
        total_pairs = len(self.symbols) * len(self.timeframes)

        logger.info(
            "scanner_backfill_starting",
            symbols=len(self.symbols),
            timeframes=self.timeframes,
            pairs=total_pairs,
        )

        for symbol in self.symbols:
            for tf in self.timeframes:
                try:
                    candles = await fetch_historical_klines(
                        symbol=symbol,
                        interval=tf,
                        limit=200,
                    )

                    buffer = self.buffer_manager.get_buffer(symbol, tf)
                    for candle in candles:
                        buffer.add_candle(candle)

                    total_candles += len(candles)
                    logger.debug(
                        "scanner_backfill_pair",
                        symbol=symbol,
                        timeframe=tf,
                        candles=len(candles),
                        buffer_ready=buffer.is_ready,
                    )
                except Exception as e:
                    logger.error(
                        "scanner_backfill_error",
                        symbol=symbol,
                        timeframe=tf,
                        error=str(e),
                    )

                # Small delay to avoid Binance rate limits (1200 req/min)
                await asyncio.sleep(0.1)

        ready_count = sum(
            1 for b in self.buffer_manager.get_all_buffers() if b.is_ready
        )
        logger.info(
            "scanner_backfill_complete",
            total_candles=total_candles,
            buffers_ready=f"{ready_count}/{total_pairs}",
        )

    async def start(self) -> None:
        """Start the scanner engine.

        Creates a WebSocket connection and processes candles indefinitely.
        """
        self._running = True
        self.stats = ScannerStats()

        logger.info(
            "scanner_starting",
            symbols=self.symbols,
            timeframes=self.timeframes,
            strategies=self.registry.count,
        )

        # Create WebSocket client
        self._ws_client = BinanceWSClient(
            symbols=self.symbols,
            timeframes=self.timeframes,
            on_candle=self._on_candle,
            on_error=self._on_ws_error,
        )

        try:
            await self._ws_client.start()
        except asyncio.CancelledError:
            logger.info("scanner_cancelled")
        finally:
            self._running = False
            if self._ws_client:
                await self._ws_client.stop()
            logger.info(
                "scanner_stopped",
                candles=self.stats.candles_processed,
                signals=self.stats.signals_generated,
                persisted=self.stats.signals_persisted,
                errors=self.stats.errors,
                uptime_s=round(self.stats.uptime_seconds, 1),
            )

    async def stop(self) -> None:
        """Gracefully stop the scanner."""
        self._running = False
        if self._ws_client:
            await self._ws_client.stop()

    async def _on_candle(self, candle: Candle) -> None:
        """Callback for each candle received from Binance WS.

        Only processes closed candles — partial candles are ignored by the buffer.
        """
        if not candle.is_closed:
            return

        self.stats.candles_processed += 1

        # Route to buffer
        buffer = self.buffer_manager.add_candle(candle)

        # Skip if buffer doesn't have enough data
        if not buffer.is_ready:
            return

        # Run all registered strategies
        for strategy, strategy_db_id in self.registry.get_all_with_ids():
            # Only run strategy on its intended timeframe
            if candle.timeframe != strategy.default_timeframe:
                # Also accept if strategy default_timeframe matches candle
                if candle.timeframe not in self.timeframes:
                    continue

            try:
                await self._evaluate_strategy(
                    strategy=strategy,
                    strategy_db_id=strategy_db_id,
                    buffer=buffer,
                    candle=candle,
                )
            except Exception as e:
                self.stats.errors += 1
                logger.error(
                    "strategy_evaluation_error",
                    strategy=strategy.name,
                    symbol=candle.symbol,
                    error=str(e),
                )

    async def _evaluate_strategy(
        self,
        strategy,
        strategy_db_id: str,
        buffer,
        candle: Candle,
    ) -> None:
        """Evaluate a single strategy against a buffer."""
        # Compute indicators using strategy-specific parameters
        indicators = strategy.compute_indicators(buffer)

        # Run strategy evaluation
        proposal = strategy.evaluate(buffer, indicators)

        if proposal is None:
            return

        self.stats.signals_generated += 1

        # Check cooldown
        cooldown_key = (proposal.symbol, strategy.name)
        last_signal = self._cooldowns.get(cooldown_key)
        if last_signal and (datetime.now(UTC) - last_signal) < SIGNAL_COOLDOWN:
            logger.debug(
                "signal_cooldown_active",
                symbol=proposal.symbol,
                strategy=strategy.name,
            )
            return

        # Persist signal
        await self._persist_signal(proposal, strategy_db_id)
        self._cooldowns[cooldown_key] = datetime.now(UTC)

    async def _persist_signal(self, proposal: SignalProposal, strategy_db_id: str) -> None:
        """Persist a signal proposal to the database."""
        try:
            client = await get_supabase_client()
            result = await (
                client.from_("signals")
                .insert({
                    "strategy_id": strategy_db_id,
                    "symbol": proposal.symbol,
                    "timeframe": proposal.timeframe,
                    "direction": proposal.direction,
                    "entry_price": proposal.entry_price,
                    "stop_loss": proposal.stop_loss,
                    "take_profit": proposal.take_profit,
                    "confidence": proposal.confidence,
                    "status": "active",
                    "metadata": proposal.metadata,
                })
                .execute()
            )

            self.stats.signals_persisted += 1
            logger.info(
                "signal_persisted",
                symbol=proposal.symbol,
                direction=proposal.direction,
                timeframe=proposal.timeframe,
                confidence=proposal.confidence,
                rr=round(proposal.risk_reward, 2),
                entry=proposal.entry_price,
            )

            # Dispatch Telegram notifications to subscribed users
            try:
                signal_data = {
                    "symbol": proposal.symbol,
                    "direction": proposal.direction,
                    "timeframe": proposal.timeframe,
                    "entry_price": proposal.entry_price,
                    "stop_loss": proposal.stop_loss,
                    "take_profit": proposal.take_profit,
                    "confidence": proposal.confidence,
                    "risk_reward": round(proposal.risk_reward, 2),
                    "strategy_name": proposal.metadata.get("strategy", "Unknown"),
                    "detected_at": datetime.now(UTC).isoformat(),
                }
                notifier = get_notification_service()
                asyncio.create_task(notifier.notify_new_signal(signal_data))
            except Exception as e:
                logger.error("notification_dispatch_error", error=str(e))

        except Exception as e:
            self.stats.errors += 1
            logger.error(
                "signal_persist_error",
                symbol=proposal.symbol,
                error=str(e),
            )

    async def _on_ws_error(self, error: Exception) -> None:
        """Handle WebSocket errors."""
        self.stats.errors += 1
        logger.error("scanner_ws_error", error=str(error))

    @property
    def is_running(self) -> bool:
        return self._running

    async def add_symbol(self, symbol: str) -> bool:
        """Add a symbol to the watchlist at runtime.

        Backfills historical candles for the new symbol and restarts
        the WebSocket connection to include it.

        Returns True if the symbol was added, False if already present.
        """
        normalized = symbol.upper().strip()
        if normalized in self.symbols:
            return False

        self.symbols.append(normalized)

        logger.info("scanner_symbol_added", symbol=normalized)

        # Backfill buffers for the new symbol
        for tf in self.timeframes:
            try:
                candles = await fetch_historical_klines(
                    symbol=normalized, interval=tf, limit=200,
                )
                buffer = self.buffer_manager.get_buffer(normalized, tf)
                for candle in candles:
                    buffer.add_candle(candle)
                logger.info(
                    "scanner_backfill_new_symbol",
                    symbol=normalized,
                    timeframe=tf,
                    candles=len(candles),
                )
            except Exception as e:
                logger.error(
                    "scanner_backfill_error",
                    symbol=normalized,
                    timeframe=tf,
                    error=str(e),
                )
            await asyncio.sleep(0.1)

        # Reconnect WebSocket with updated symbol list
        if self._running:
            await self._restart_ws()

        return True

    async def remove_symbol(self, symbol: str) -> bool:
        """Remove a symbol from the watchlist at runtime.

        Stops streaming data for this symbol. Existing buffers are
        garbage-collected naturally.

        Returns True if the symbol was removed, False if not present.
        """
        normalized = symbol.upper().strip()
        if normalized not in self.symbols:
            return False

        self.symbols.remove(normalized)

        # Clean up cooldowns for this symbol
        keys_to_remove = [k for k in self._cooldowns if k[0] == normalized]
        for key in keys_to_remove:
            del self._cooldowns[key]

        logger.info("scanner_symbol_removed", symbol=normalized)

        # Reconnect WebSocket with updated symbol list
        if self._running:
            await self._restart_ws()

        return True

    async def _restart_ws(self) -> None:
        """Restart the WebSocket connection with the current symbol list.

        Called internally after add/remove symbol to update the stream subscription.
        """
        if not self._ws_client:
            return

        logger.info(
            "scanner_ws_restarting",
            symbols=len(self.symbols),
            streams=len(self.symbols) * len(self.timeframes),
        )

        # Stop current connection
        await self._ws_client.stop()

        # Create new client with updated symbols
        self._ws_client = BinanceWSClient(
            symbols=self.symbols,
            timeframes=self.timeframes,
            on_candle=self._on_candle,
            on_error=self._on_ws_error,
        )

        # Start in background (don't await — it blocks until stopped)
        asyncio.create_task(self._ws_client.start())

    def get_status(self) -> dict:
        """Get current scanner status for the API."""
        return {
            "running": self._running,
            "connected": self._ws_client.is_connected if self._ws_client else False,
            "symbols": self.symbols,
            "timeframes": self.timeframes,
            "strategies": self.registry.count,
            "stats": {
                "candles_processed": self.stats.candles_processed,
                "signals_generated": self.stats.signals_generated,
                "signals_persisted": self.stats.signals_persisted,
                "errors": self.stats.errors,
                "uptime_seconds": round(self.stats.uptime_seconds, 1),
            },
            "buffers": self.buffer_manager.get_buffer_stats(),
        }

