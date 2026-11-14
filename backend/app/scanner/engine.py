"""Tram Backend - Scanner Engine.

The main loop that orchestrates the signal detection pipeline:
    1. Receives candles from BinanceWSClient (enqueued, never processed inline)
    2. A worker task routes them to CandleBufferManager
    3. Runs all registered strategies on each closed candle
    4. Persists valid signals to Supabase

Runs as an async task alongside the FastAPI server or as a
standalone worker process.
"""

import asyncio
import contextlib
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.client import get_supabase_client
from app.scanner.binance_ws import BinanceWSClient, Candle, fetch_historical_klines
from app.scanner.candle_buffer import (
    DEFAULT_BUFFER_SIZE,
    CandleBufferManager,
    timeframe_to_timedelta,
)
from app.services.notification_service import get_notification_service
from app.strategies.base import SignalProposal
from app.strategies.registry import StrategyRegistry
from app.scanner.symbols import SCANNER_SYMBOLS as DEFAULT_SYMBOLS

logger = get_logger(__name__)

# Connectivity problems (WiFi / internet down) are expected and self-healing:
# they are logged as warnings and shown as "reconnecting", never counted as errors.
NETWORK_ERRORS = (OSError, TimeoutError, httpx.TransportError)


# 1d is not used by any current strategy (1h / 4h only), so it is not
# subscribed by default. Add it back if a 1d strategy is introduced.
DEFAULT_TIMEFRAMES = ["1h", "4h"]

# Cooldown between signals for the same (symbol, strategy, direction),
# measured in candles of the signal's own timeframe. Using candle open_time
# (instead of wall-clock) makes it deterministic: 3 candles = 3h on 1h,
# 12h on 4h.
SIGNAL_COOLDOWN_CANDLES = 3

# Fallback absolute cooldown for timeframes with unknown length (e.g. "1M").
SIGNAL_COOLDOWN_FALLBACK = timedelta(hours=4)

# Backfill / buffers
BACKFILL_LIMIT = DEFAULT_BUFFER_SIZE

# Bounded memory for WS message dedupe
MAX_PROCESSED_KEYS = 5000

# Candle queue between the WS reader and the strategy worker
QUEUE_MAXSIZE = 1000

# Strategy loading at startup
STRATEGY_LOAD_RETRIES = 3


@dataclass
class ScannerStats:
    """Runtime statistics for the scanner engine."""

    candles_processed: int = 0
    signals_generated: int = 0
    signals_suppressed: int = 0  # blocked by cooldown
    signals_persisted: int = 0
    gap_repairs: int = 0
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
        settings = get_settings()
        # Copy: add_symbol/remove_symbol mutate these lists and must never
        # touch DEFAULT_SYMBOLS, the caller's list, or cached settings.
        self.symbols: list[str] = list(
            symbols or DEFAULT_SYMBOLS
        )
        self.timeframes: list[str] = list(
            timeframes or settings.scanner_timeframe_list or DEFAULT_TIMEFRAMES
        )

        self.buffer_manager = CandleBufferManager()
        self.registry = StrategyRegistry()
        self.stats = ScannerStats()

        # Cooldown tracking: (symbol, strategy_name, direction) -> open_time of
        # the candle that produced the last signal.
        self._cooldowns: dict[tuple[str, str, str], datetime] = {}

        # Dedupe for WS candle messages (e.g. replay after reconnect).
        # dict used as an insertion-ordered bounded set.
        self._processed_candles: dict[tuple[str, str, datetime], None] = {}

        # (symbol, timeframe) pairs whose buffer is known to be incomplete
        # (a backfill failed). Evaluation is skipped until a backfill succeeds.
        self._stale_buffers: set[tuple[str, str]] = set()

        self._ws_client: BinanceWSClient | None = None
        self._queue: asyncio.Queue[Candle] | None = None
        self._worker_task: asyncio.Task | None = None
        self._background_tasks: set[asyncio.Task] = set()
        self._symbols_lock = asyncio.Lock()
        self._restart_requested = False
        self._running = False
        self._settings = settings

        # Latest real (non-network) error, for display. Cleared by clear_errors().
        self.last_error: dict | None = None

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    async def _load_strategy_ids(self) -> dict[str, str]:
        """Fetch strategy name -> UUID from the DB, retrying with backoff.

        Raises RuntimeError if the DB cannot be reached: random fallback UUIDs
        would violate the signals.strategy_id foreign key and silently lose
        every signal, so failing loudly is safer.
        """
        last_error: Exception | None = None
        for attempt in range(1, STRATEGY_LOAD_RETRIES + 1):
            try:
                client = await get_supabase_client()
                result = await (
                    client.from_("strategies")
                    .select("id, name")
                    .eq("is_system", True)
                    .eq("is_active", True)
                    .execute()
                )
                return {row["name"]: row["id"] for row in result.data}
            except Exception as e:  # noqa: BLE001
                last_error = e
                logger.warning(
                    "scanner_strategy_load_retry",
                    attempt=attempt,
                    max_attempts=STRATEGY_LOAD_RETRIES,
                    error=str(e),
                )
                if attempt < STRATEGY_LOAD_RETRIES:
                    await asyncio.sleep(2**attempt)
        raise RuntimeError("Could not load strategies from database") from last_error

    async def initialize(self) -> None:
        """Initialize the scanner: discover strategies, load DB IDs, backfill buffers."""
        logger.info("scanner_initializing")

        # Auto-discover strategy classes
        self.registry.auto_discover()

        strategy_db_map = await self._load_strategy_ids()
        count = self.registry.initialize_from_classes(strategy_db_map)

        logger.info(
            "scanner_strategies_loaded",
            registered=count,
            db_strategies=list(strategy_db_map.keys()),
        )

        if count == 0:
            raise RuntimeError(
                "No strategies registered: check that active system strategies "
                "in the DB match the discovered strategy names "
                f"(db: {list(strategy_db_map.keys())})"
            )

        # Backfill historical candles so buffers are immediately ready
        await self._backfill_buffers()

    async def _backfill_pair(self, symbol: str, timeframe: str) -> bool:
        """(Re)fill one buffer from the REST API. Returns True on success.

        Replaces the buffer contents, so it is safe for both initial fill and
        gap repair. On failure the pair is marked stale and skipped by the
        evaluation path until a later backfill succeeds.
        """
        key = (symbol, timeframe)
        try:
            candles = await fetch_historical_klines(
                symbol=symbol,
                interval=timeframe,
                limit=BACKFILL_LIMIT,
            )
            buffer = self.buffer_manager.get_buffer(symbol, timeframe)
            buffer.replace(candles)
            self._stale_buffers.discard(key)
            logger.debug(
                "scanner_backfill_pair",
                symbol=symbol,
                timeframe=timeframe,
                candles=len(candles),
                buffer_ready=buffer.is_ready,
            )
            return True
        except NETWORK_ERRORS as e:
            # Internet is down: keep the buffer marked stale so it is rebuilt
            # on the next live candle, but don't report it as an error.
            self._stale_buffers.add(key)
            logger.warning(
                "scanner_backfill_network_unavailable",
                symbol=symbol,
                timeframe=timeframe,
                error_type=type(e).__name__,
            )
            return False
        except Exception as e:  # noqa: BLE001
            self._stale_buffers.add(key)
            self._record_error("backfill", f"{symbol} {timeframe}: {e}")
            logger.error(
                "scanner_backfill_error",
                symbol=symbol,
                timeframe=timeframe,
                error=str(e),
            )
            return False

    async def _backfill_buffers(self) -> None:
        """Fetch historical candles from Binance REST API to pre-fill buffers.

        This eliminates the cold-start problem where buffers need 30+ hours
        of live data before strategies can evaluate.
        """
        total_pairs = len(self.symbols) * len(self.timeframes)

        logger.info(
            "scanner_backfill_starting",
            symbols=len(self.symbols),
            timeframes=self.timeframes,
            pairs=total_pairs,
        )

        for symbol in self.symbols:
            for tf in self.timeframes:
                await self._backfill_pair(symbol, tf)
                # Small delay to avoid Binance rate limits (1200 req/min)
                await asyncio.sleep(0.1)

        ready_count = sum(1 for b in self.buffer_manager.get_all_buffers() if b.is_ready)
        logger.info(
            "scanner_backfill_complete",
            buffers_ready=f"{ready_count}/{total_pairs}",
            stale=len(self._stale_buffers),
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def _new_ws_client(self) -> BinanceWSClient:
        return BinanceWSClient(
            symbols=list(self.symbols),
            timeframes=list(self.timeframes),
            on_candle=self._on_candle,
            on_error=self._on_ws_error,
        )

    async def start(self) -> None:
        """Start the scanner engine.

        Runs a candle worker plus a WebSocket loop. The WS client is rebuilt
        in-place whenever `_restart_ws()` requests it (symbol list changed),
        so a restart never ends this coroutine.
        """
        self._running = True
        self._restart_requested = False
        self.stats = ScannerStats()
        self._processed_candles.clear()
        self._queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        self._worker_task = asyncio.create_task(self._worker(), name="scanner-worker")

        logger.info(
            "scanner_starting",
            symbols=self.symbols,
            timeframes=self.timeframes,
            strategies=self.registry.count,
        )

        try:
            while self._running:
                self._restart_requested = False
                self._ws_client = self._new_ws_client()
                await self._ws_client.start()  # returns when stopped
                if not self._restart_requested:
                    break
                logger.info("scanner_ws_restarted")
        except asyncio.CancelledError:
            logger.info("scanner_cancelled")
        finally:
            self._running = False
            if self._ws_client:
                await self._ws_client.stop()
            if self._worker_task:
                self._worker_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._worker_task
                self._worker_task = None
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
        self._restart_requested = False
        if self._ws_client:
            await self._ws_client.stop()

    @property
    def is_running(self) -> bool:
        return self._running

    # ------------------------------------------------------------------
    # Candle pipeline
    # ------------------------------------------------------------------

    async def _on_candle(self, candle: Candle) -> None:
        """WS callback: enqueue closed candles and return immediately.

        Heavy work (indicators, DB inserts, REST gap repair) happens in the
        worker so a slow DB can't stall the WebSocket reader.
        """
        if not candle.is_closed or self._queue is None:
            return
        await self._queue.put(candle)

    async def _worker(self) -> None:
        """Consume candles from the queue in arrival order."""
        assert self._queue is not None
        while True:
            candle = await self._queue.get()
            try:
                await self._process_candle(candle)
            except NETWORK_ERRORS as e:
                logger.warning(
                    "candle_processing_network_unavailable",
                    symbol=candle.symbol,
                    error_type=type(e).__name__,
                )
            except Exception as e:  # noqa: BLE001
                self._record_error("candle", f"{candle.symbol} {candle.timeframe}: {e}")
                logger.error(
                    "candle_processing_error",
                    symbol=candle.symbol,
                    timeframe=candle.timeframe,
                    error=str(e),
                )
            finally:
                self._queue.task_done()

    def _is_duplicate(self, candle: Candle) -> bool:
        key = (candle.symbol, candle.timeframe, candle.open_time)
        if key in self._processed_candles:
            return True
        self._processed_candles[key] = None
        if len(self._processed_candles) > MAX_PROCESSED_KEYS:
            oldest = next(iter(self._processed_candles))
            del self._processed_candles[oldest]
        return False

    async def _process_candle(self, candle: Candle) -> None:
        """Route one closed candle to its buffer and run strategies on it."""
        if candle.symbol not in self.symbols:
            return  # symbol removed while candle was queued

        if self._is_duplicate(candle):
            return

        self.stats.candles_processed += 1

        buffer = self.buffer_manager.get_buffer(candle.symbol, candle.timeframe)
        pair = (candle.symbol, candle.timeframe)

        # Missed candles (WS reconnect, restart, failed backfill)? Rebuild the
        # buffer from REST so indicators are computed over contiguous data.
        if pair in self._stale_buffers or buffer.has_gap(candle):
            logger.warning(
                "scanner_buffer_gap_detected",
                symbol=candle.symbol,
                timeframe=candle.timeframe,
                last_open=(buffer.latest_candle().open_time.isoformat()
                           if buffer.latest_candle() else None),
                new_open=candle.open_time.isoformat(),
            )
            ok = await self._backfill_pair(candle.symbol, candle.timeframe)
            if ok:
                self.stats.gap_repairs += 1
            else:
                # _backfill_pair already logged/counted it if it was a real
                # error; a network outage is intentionally not counted.
                return  # don't evaluate on incomplete data

        buffer = self.buffer_manager.add_candle(candle)

        if not buffer.is_ready:
            return

        for strategy, strategy_db_id in self.registry.get_all_with_ids():
            # Only run strategy on its intended timeframe
            if candle.timeframe != strategy.default_timeframe:
                continue

            try:
                await self._evaluate_strategy(
                    strategy=strategy,
                    strategy_db_id=strategy_db_id,
                    buffer=buffer,
                    candle=candle,
                )
            except Exception as e:  # noqa: BLE001
                self._record_error("strategy", f"{strategy.name} {candle.symbol}: {e}")
                logger.error(
                    "strategy_evaluation_error",
                    strategy=strategy.name,
                    symbol=candle.symbol,
                    error=str(e),
                )

    @staticmethod
    def _cooldown_for(timeframe: str) -> timedelta:
        interval = timeframe_to_timedelta(timeframe)
        if interval is None:
            return SIGNAL_COOLDOWN_FALLBACK
        return interval * SIGNAL_COOLDOWN_CANDLES

    async def _evaluate_strategy(
        self,
        strategy,
        strategy_db_id: str,
        buffer,
        candle: Candle,
    ) -> None:
        """Evaluate a single strategy against a buffer."""
        indicators = strategy.compute_indicators(buffer)
        proposal = strategy.evaluate(buffer, indicators)

        if proposal is None:
            return

        self.stats.signals_generated += 1

        # Cooldown based on candle open_time (deterministic, no wall-clock jitter)
        cooldown_key = (proposal.symbol, strategy.name, proposal.direction)
        previous = self._cooldowns.get(cooldown_key)
        if previous and (candle.open_time - previous) < self._cooldown_for(candle.timeframe):
            self.stats.signals_suppressed += 1
            logger.debug(
                "signal_cooldown_active",
                symbol=proposal.symbol,
                strategy=strategy.name,
                direction=proposal.direction,
            )
            return

        # Reserve the cooldown *before* the await so a concurrent evaluation
        # can't pass the same check; roll back if persisting fails.
        self._cooldowns[cooldown_key] = candle.open_time
        persisted = await self._persist_signal(proposal, strategy_db_id)
        if not persisted:
            if previous is None:
                self._cooldowns.pop(cooldown_key, None)
            else:
                self._cooldowns[cooldown_key] = previous

    async def _persist_signal(self, proposal: SignalProposal, strategy_db_id: str) -> bool:
        """Persist a signal proposal to the database. Returns True on success."""
        try:
            client = await get_supabase_client()
            await (
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
        except NETWORK_ERRORS as e:
            # Internet down: the signal can't be saved, so the caller rolls the
            # cooldown back and it can fire again on a later candle. Not an
            # application error, so don't count it.
            logger.warning(
                "signal_persist_network_unavailable",
                symbol=proposal.symbol,
                error_type=type(e).__name__,
            )
            return False
        except Exception as e:  # noqa: BLE001
            self._record_error("persist", f"{proposal.symbol}: {e}")
            logger.error(
                "signal_persist_error",
                symbol=proposal.symbol,
                error=str(e),
            )
            return False

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

        self._dispatch_notification(proposal)
        return True

    def _dispatch_notification(self, proposal: SignalProposal) -> None:
        """Fire-and-forget Telegram notification, with errors logged."""
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
            task = asyncio.create_task(notifier.notify_new_signal(signal_data))
        except Exception as e:  # noqa: BLE001
            logger.error("notification_dispatch_error", error=str(e))
            return

        # Keep a strong reference (tasks can be GC'd mid-flight) and surface
        # exceptions raised inside the task.
        self._background_tasks.add(task)
        task.add_done_callback(self._on_background_task_done)

    def _on_background_task_done(self, task: asyncio.Task) -> None:
        self._background_tasks.discard(task)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.error("notification_task_error", error=str(exc))

    async def _on_ws_error(self, error: Exception) -> None:
        """Handle WebSocket errors."""
        if isinstance(error, NETWORK_ERRORS):
            # Safety net in case a transient network error reaches us anyway.
            logger.warning("scanner_ws_network_unavailable", error=str(error)[:100])
            return
        self._record_error("websocket", str(error))
        logger.error("scanner_ws_error", error=str(error))

    def _record_error(self, source: str, message: str) -> None:
        """Count a real error and remember the latest one for the UI."""
        self.stats.errors += 1
        self.last_error = {
            "source": source,
            "message": message[:300],
            "at": datetime.now(UTC).isoformat(),
        }

    def clear_errors(self) -> None:
        """Reset the error counter and last error (e.g. from a 'dismiss' button)."""
        self.stats.errors = 0
        self.last_error = None

    # ------------------------------------------------------------------
    # Runtime watchlist changes
    # ------------------------------------------------------------------

    async def add_symbol(self, symbol: str) -> bool:
        """Add a symbol to the watchlist at runtime.

        Backfills historical candles for the new symbol and restarts
        the WebSocket connection to include it.

        Returns True if the symbol was added, False if already present.
        """
        normalized = symbol.upper().strip()

        async with self._symbols_lock:
            if normalized in self.symbols:
                return False

            self.symbols.append(normalized)
            logger.info("scanner_symbol_added", symbol=normalized)

            # Backfill buffers for the new symbol. Failures leave the pair
            # marked stale; the worker retries on the first live candle.
            for tf in self.timeframes:
                await self._backfill_pair(normalized, tf)
                await asyncio.sleep(0.1)

            if self._running:
                await self._restart_ws()

        return True

    async def remove_symbol(self, symbol: str) -> bool:
        """Remove a symbol from the watchlist at runtime.

        Stops streaming data for this symbol and drops its buffers and cooldowns.

        Returns True if the symbol was removed, False if not present.
        """
        normalized = symbol.upper().strip()

        async with self._symbols_lock:
            if normalized not in self.symbols:
                return False

            self.symbols.remove(normalized)

            for key in [k for k in self._cooldowns if k[0] == normalized]:
                del self._cooldowns[key]
            self._stale_buffers = {p for p in self._stale_buffers if p[0] != normalized}
            self.buffer_manager.remove_symbol(normalized)

            logger.info("scanner_symbol_removed", symbol=normalized)

            if self._running:
                await self._restart_ws()

        return True

    async def _restart_ws(self) -> None:
        """Ask the running `start()` loop to rebuild the WS client.

        Stopping the current client makes `BinanceWSClient.start()` return;
        `start()` sees `_restart_requested` and creates a new client with the
        current symbol list instead of shutting the engine down.
        """
        if not self._ws_client:
            return

        logger.info(
            "scanner_ws_restarting",
            symbols=len(self.symbols),
            streams=len(self.symbols) * len(self.timeframes),
        )

        self._restart_requested = True
        await self._ws_client.stop()

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        """Get current scanner status for the API."""
        buffer_stats = self.buffer_manager.get_buffer_stats()
        total_buffered = sum(buffer_stats.values())
        ws = self._ws_client
        return {
            "running": self._running,
            "connected": ws.is_connected if ws else False,
            # "connected" | "reconnecting" | "connecting" | "stopped".
            # The frontend should drive its "Reconnecting…" badge from this,
            # not from the error counter.
            "connection": {
                "state": ws.state if ws else "stopped",
                "reconnect_attempts": ws.reconnect_attempts if ws else 0,
            },
            "last_error": self.last_error,
            "symbols": self.symbols,
            "timeframes": self.timeframes,
            "strategies": self.registry.count,
            "queue_size": self._queue.qsize() if self._queue else 0,
            "stale_buffers": len(self._stale_buffers),
            "stats": {
                "candles_processed": self.stats.candles_processed,
                "buffered_candles": total_buffered,
                "signals_generated": self.stats.signals_generated,
                "signals_suppressed": self.stats.signals_suppressed,
                "signals_persisted": self.stats.signals_persisted,
                "gap_repairs": self.stats.gap_repairs,
                "errors": self.stats.errors,
                "uptime_seconds": round(self.stats.uptime_seconds, 1),
            },
            "buffers": buffer_stats,
        }