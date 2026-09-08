"""FastAPI dependencies for authentication and authorization."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.jwt import jwt_service

# Security scheme
security = HTTPBearer(auto_error=False)

_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "testclient"}


async def _dev_bypass_user(request: Request, db: AsyncSession) -> User | None:
    """DEV ONLY: if enabled AND the request is from loopback, return the
    admin user instead of enforcing JWT auth. See Settings.disable_auth_localhost."""
    if not settings.disable_auth_localhost:
        return None
    client_host = request.client.host if request.client else None
    if client_host not in _LOOPBACK_HOSTS:
        return None

    result = await db.execute(
        select(User).where(User.email.in_(_admin_emails())).order_by(User.created_at.asc())
    )
    return result.scalars().first()


def _admin_emails() -> list[str]:
    return [e.strip().lower() for e in settings.admin_emails.split(",") if e.strip()]


async def get_current_user_optional(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Get current user if authenticated, None otherwise."""
    bypass_user = await _dev_bypass_user(request, db)
    if bypass_user:
        return bypass_user

    if not credentials:
        return None

    token = credentials.credentials
    payload = jwt_service.verify_access_token(token)

    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user and user.is_active and not user.is_banned:
        return user

    return None


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get current authenticated user. Raises 401 if not authenticated."""
    bypass_user = await _dev_bypass_user(request, db)
    if bypass_user:
        return bypass_user

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = jwt_service.verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is banned",
        )

    return user


async def get_verified_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Get current user with verified email and name."""
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified",
        )

    if not user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Name not verified. Please complete profile setup.",
        )

    return user


async def get_admin_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Get current user with admin privileges."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return user


# Type aliases for cleaner route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
VerifiedUser = Annotated[User, Depends(get_verified_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
