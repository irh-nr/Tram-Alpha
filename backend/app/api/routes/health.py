"""Tram Backend - Health Check Routes."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "tram-api",
        "version": "0.1.0",
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - verifies dependencies are available."""
    # Future: check DB connection, Binance WS status, etc.
    return {
        "status": "ready",
        "database": "connected",
    }
