"""Tram Backend - Scanner Worker Entrypoint.

Standalone process for running the scanner engine. Can be launched
alongside the FastAPI server or in a separate container.

Usage:
    python -m app.workers.scanner_worker
    python -m app.workers.scanner_worker --symbols BTCUSDT,ETHUSDT --timeframes 1h,4h
"""

import argparse
import asyncio
import signal as signal_module
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.scanner.engine import DEFAULT_SYMBOLS, DEFAULT_TIMEFRAMES, ScannerEngine

logger = get_logger(__name__)


async def run_scanner(symbols: list[str], timeframes: list[str]) -> None:
    """Run the scanner engine with graceful shutdown."""
    settings = get_settings()
    setup_logging("DEBUG" if settings.is_development else "INFO")

    logger.info(
        "scanner_worker_starting",
        env=settings.app_env,
        symbols=symbols,
        timeframes=timeframes,
    )

    engine = ScannerEngine(symbols=symbols, timeframes=timeframes)

    # Handle shutdown signals
    loop = asyncio.get_event_loop()
    shutdown_event = asyncio.Event()

    def _shutdown_handler():
        logger.info("scanner_worker_shutdown_signal")
        shutdown_event.set()

    for sig in (signal_module.SIGINT, signal_module.SIGTERM):
        try:
            loop.add_signal_handler(sig, _shutdown_handler)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            signal_module.signal(sig, lambda s, f: _shutdown_handler())

    try:
        await engine.initialize()

        # Run engine in background task
        engine_task = asyncio.create_task(engine.start())

        # Wait for shutdown signal
        await shutdown_event.wait()

        # Graceful shutdown
        logger.info("scanner_worker_stopping")
        await engine.stop()
        engine_task.cancel()

        try:
            await engine_task
        except asyncio.CancelledError:
            pass

    except Exception as e:
        logger.error("scanner_worker_fatal_error", error=str(e))
        raise
    finally:
        logger.info("scanner_worker_exited")


def main():
    parser = argparse.ArgumentParser(description="Tram Scanner Worker")
    parser.add_argument(
        "--symbols",
        type=str,
        default=",".join(DEFAULT_SYMBOLS),
        help="Comma-separated list of symbols to scan",
    )
    parser.add_argument(
        "--timeframes",
        type=str,
        default=",".join(DEFAULT_TIMEFRAMES),
        help="Comma-separated list of timeframes",
    )

    args = parser.parse_args()
    symbols = [s.strip().upper() for s in args.symbols.split(",")]
    timeframes = [t.strip() for t in args.timeframes.split(",")]

    asyncio.run(run_scanner(symbols, timeframes))


if __name__ == "__main__":
    main()
