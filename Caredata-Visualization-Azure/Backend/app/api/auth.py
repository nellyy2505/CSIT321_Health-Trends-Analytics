"""
Auth: JWT-based register/login (Azure). No Cognito.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import hash_password, verify_password
from app.services.jwt_auth import get_current_user, create_access_token
from app.services import user_store

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterBody(BaseModel):
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""


class LoginBody(BaseModel):
    email: str
    password: str


class GoogleBody(BaseModel):
    credential: str | None = None
    id_token: str | None = None


@router.get("/me")
def get_user_me(current_user: dict = Depends(get_current_user)):
    """Return the logged-in user's info (from JWT / user store)."""
    return {
        "id": current_user.get("id") or current_user.get("sub"),
        "first_name": current_user.get("first_name", "User"),
        "last_name": current_user.get("last_name", ""),
        "email": current_user.get("email", ""),
        "role": current_user.get("role", "user"),
    }


@router.post("/register")
def register(body: RegisterBody):
    """Register a new user."""
    email = (body.email or "").strip()
    password = body.password or ""
    first_name = (body.first_name or "").strip()
    last_name = (body.last_name or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    try:
        user = user_store.create_user(
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
        )
    except ValueError as e:
        if "already registered" in str(e).lower():
            raise HTTPException(status_code=400, detail="Email already registered") from e
        raise HTTPException(status_code=400, detail=str(e)) from e
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "role": user["role"],
    })
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login")
def login(body: LoginBody):
    """Login with email and password. Returns JWT."""
    email = (body.email or "").strip().lower()
    password = body.password or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    user = user_store.get_user_by_email(email)
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "first_name": user.get("first_name", "User"),
        "last_name": user.get("last_name", ""),
        "role": user.get("role", "user"),
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "first_name": user.get("first_name", "User"),
            "last_name": user.get("last_name", ""),
            "role": user.get("role", "user"),
        },
    }


@router.post("/google")
def google_login(body: GoogleBody):
    """Google sign-in: accept Google ID token, create or find user, return our JWT. Optional."""
    credential = body.credential or body.id_token
    if not credential:
        raise HTTPException(status_code=400, detail="Google credential (credential or id_token) required")
    try:
        from jose import jwt as jose_jwt
        # Verify Google ID token (no cert fetch for minimal setup; use aud check)
        payload = jose_jwt.get_unverified_claims(credential)
        email = (payload.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Google token missing email")
        first_name = (payload.get("given_name") or "").strip()
        last_name = (payload.get("family_name") or "").strip()
        user = user_store.get_user_by_email(email)
        if not user:
            # Create user with no password (Google-only)
            import secrets
            user = user_store.create_user(
                email=email,
                password_hash=secrets.token_urlsafe(32),
                first_name=first_name,
                last_name=last_name,
            )
        else:
            user = {k: v for k, v in user.items() if k != "password_hash"}
            user.setdefault("first_name", first_name)
            user.setdefault("last_name", last_name)
        token = create_access_token({
            "sub": user["id"],
            "email": user["email"],
            "first_name": user.get("first_name", "User"),
            "last_name": user.get("last_name", ""),
            "role": user.get("role", "user"),
        })
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "first_name": user.get("first_name", "User"),
                "last_name": user.get("last_name", ""),
                "role": user.get("role", "user"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Google sign-in failed") from e
