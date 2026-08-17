"""Tram Backend - API Dependencies."""

from typing import Annotated

from fastapi import Depends

from app.core.security import AuthenticatedUser, get_current_user

# Reusable dependency type for route handlers
CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
