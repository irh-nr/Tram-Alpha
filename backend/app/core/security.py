"""Tram Backend - JWT Security & Auth Verification."""

from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AuthenticatedUser:
    """Represents a verified user from Supabase JWT."""

    def __init__(self, user_id: str, email: str, role: str = "authenticated"):
        self.id = user_id
        self.email = email
        self.role = role

    def __repr__(self) -> str:
        return f"AuthenticatedUser(id={self.id}, email={self.email})"


import httpx

async def verify_jwt(token: str) -> AuthenticatedUser:
    """Verify a Supabase JWT by calling the Supabase Auth server."""
    settings = get_settings()

    url = f"{settings.supabase_url}/auth/v1/user"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            }
        )
        
        if response.status_code != 200:
            error_data = response.json()
            msg = error_data.get("msg", "Invalid or expired token")
            logger.error("jwt_verification_failed", status=response.status_code, error=msg)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired token: {msg}",
            )
            
        user_data = response.json()
        user_id = user_data.get("id")
        email = user_data.get("email", "")
        role = user_data.get("role", "authenticated")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )

        return AuthenticatedUser(user_id=user_id, email=email, role=role)


async def get_current_user(request: Request) -> AuthenticatedUser:
    """Extract and verify the current user from request headers."""
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )

    token = auth_header.split(" ", 1)[1]
    return await verify_jwt(token)
