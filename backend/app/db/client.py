"""Tram Backend - Supabase Database Client via PostgREST."""

import httpx
from postgrest import AsyncPostgrestClient

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: AsyncPostgrestClient | None = None


async def get_supabase_client() -> AsyncPostgrestClient:
    """Get or create the PostgREST async client (service role for backend operations)."""
    global _client

    if _client is None:
        settings = get_settings()
        rest_url = f"{settings.supabase_url}/rest/v1"
        _client = AsyncPostgrestClient(
            rest_url,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
        )
        logger.info("postgrest_client_initialized", url=rest_url)

    return _client


async def supabase_rpc(function_name: str, params: dict | None = None) -> dict:
    """Call a Supabase RPC function directly via HTTP."""
    settings = get_settings()
    url = f"{settings.supabase_url}/rest/v1/rpc/{function_name}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json=params or {},
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        return response.json()
