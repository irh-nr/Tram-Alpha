"""Tram Backend - FastAPI Application Factory."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import alerts, health, journal, scanner, signals, strategies, trades
from app.api.routes.scanner import set_scanner_engine
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.scanner.engine import ScannerEngine

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    settings = get_settings()
    setup_logging("DEBUG" if settings.is_development else "INFO")
    logger.info("tram_api_starting", env=settings.app_env)

    # Start scanner engine as an in-process background task
    engine: ScannerEngine | None = None
    scanner_task: asyncio.Task | None = None

    try:
        engine = ScannerEngine()
        await engine.initialize()
        scanner_task = asyncio.create_task(engine.start())
        set_scanner_engine(engine)
        logger.info("scanner_embedded_started")
    except Exception as e:
        logger.error("scanner_embedded_start_failed", error=str(e))
        engine = None
        scanner_task = None

    yield

    # Graceful scanner shutdown
    if engine:
        logger.info("scanner_embedded_stopping")
        await engine.stop()
    if scanner_task:
        scanner_task.cancel()
        try:
            await scanner_task
        except asyncio.CancelledError:
            pass
    set_scanner_engine(None)

    logger.info("tram_api_shutting_down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # Rate limiting
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS
    cors_origins = settings.cors_origin_list
    allow_all = "*" in cors_origins

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else cors_origins,
        allow_credentials=not allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes
    app.include_router(health.router, prefix="/api")
    app.include_router(signals.router, prefix="/api")
    app.include_router(trades.router, prefix="/api")
    app.include_router(strategies.router, prefix="/api")
    app.include_router(scanner.router, prefix="/api")
    app.include_router(journal.router, prefix="/api")
    app.include_router(alerts.router, prefix="/api")

    return app


app = create_app()
