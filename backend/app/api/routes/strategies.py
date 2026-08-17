"""Tram Backend - Strategy API Routes."""

from fastapi import APIRouter, Depends

from app.core.logging import get_logger
from app.core.security import AuthenticatedUser, get_current_user
from app.db.client import get_supabase_client

logger = get_logger(__name__)

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.get("")
async def list_strategies(user: AuthenticatedUser = Depends(get_current_user)):
    """List all available strategies with user subscription status."""
    client = await get_supabase_client()

    # Get all active system strategies
    strategies_result = await (
        client.from_("strategies")
        .select("*")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    # Get user's subscribed strategies
    user_strategies_result = await (
        client.from_("user_strategies")
        .select("strategy_id, is_enabled, custom_parameters")
        .eq("user_id", user.id)
        .execute()
    )

    # Build user subscription map
    user_subs = {}
    for us in user_strategies_result.data:
        user_subs[us["strategy_id"]] = {
            "is_enabled": us["is_enabled"],
            "custom_parameters": us["custom_parameters"],
        }

    # Merge
    result = []
    for s in strategies_result.data:
        sub = user_subs.get(s["id"], {})
        result.append({
            **s,
            "user_enabled": sub.get("is_enabled", False),
            "user_parameters": sub.get("custom_parameters", {}),
        })

    return {"strategies": result, "total": len(result)}


@router.post("/{strategy_id}/subscribe")
async def subscribe_strategy(
    strategy_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Subscribe to a strategy."""
    client = await get_supabase_client()

    await (
        client.from_("user_strategies")
        .upsert({
            "user_id": user.id,
            "strategy_id": strategy_id,
            "is_enabled": True,
        })
        .execute()
    )

    return {"status": "subscribed", "strategy_id": strategy_id}


@router.delete("/{strategy_id}/subscribe")
async def unsubscribe_strategy(
    strategy_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Unsubscribe from a strategy."""
    client = await get_supabase_client()

    await (
        client.from_("user_strategies")
        .delete()
        .eq("user_id", user.id)
        .eq("strategy_id", strategy_id)
        .execute()
    )

    return {"status": "unsubscribed", "strategy_id": strategy_id}
