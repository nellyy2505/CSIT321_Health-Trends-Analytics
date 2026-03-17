"""
JWT-based auth for Azure: verify Bearer token and return current user.
Used by all protected routes instead of Cognito.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from app.core.config import settings
from app.services import user_store

security = HTTPBearer(auto_error=False)


def create_access_token(data: dict):
    """Create JWT for user (sub, email, first_name, last_name, role)."""
    from datetime import datetime, timedelta
    from app.core.security import create_access_token as _create
    expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create(data, expires_delta=expire)


def verify_token(token: str) -> dict:
    """Decode and verify JWT; return payload (sub, email, first_name, last_name, role). Raises on invalid."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True},
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Dependency: validate Bearer JWT and return user dict for use in /auth/me and other routes.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    # Prefer fresh profile from user_store if available
    profile = user_store.get_user_by_id(user_id)
    if profile:
        return {
            "id": profile.get("id") or user_id,
            "sub": profile.get("id") or user_id,
            "email": profile.get("email", ""),
            "first_name": profile.get("first_name", "User"),
            "last_name": profile.get("last_name", ""),
            "role": profile.get("role", "user"),
        }
    # Fallback to token claims
    return {
        "id": user_id,
        "sub": user_id,
        "email": payload.get("email", ""),
        "first_name": payload.get("first_name") or "User",
        "last_name": payload.get("last_name", ""),
        "role": payload.get("role", "user"),
    }
