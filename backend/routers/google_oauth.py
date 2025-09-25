from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User
from database import get_session
from auth_utils import create_access_token
import os
import logging
from authlib.integrations.starlette_client import OAuth
from starlette.responses import RedirectResponse

logger = logging.getLogger(__name__)

google_oauth = APIRouter(tags=["auth"])

# Environment variables
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    raise RuntimeError("Google OAuth credentials are missing. Check environment variables.")

# Configure OAuth
oauth = OAuth()
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@google_oauth.get("/auth/google/login")
async def google_login(request: Request):
    """Redirect user to Google for login."""
    return await oauth.google.authorize_redirect(request, GOOGLE_REDIRECT_URI)


@google_oauth.get("/auth/google/callback")
async def google_callback(
    request: Request, session: AsyncSession = Depends(get_session)
):
    """Handle Google OAuth callback and issue JWT."""
    try:
        token = await oauth.google.authorize_access_token(request)

        if "id_token" not in token:
            raise HTTPException(status_code=400, detail="No ID token returned from Google")

        user_info = await oauth.google.parse_id_token(request, token)
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to retrieve user info from Google")

        google_id = user_info["sub"]
        email = user_info["email"]
        name = user_info.get("name")
        avatar = user_info.get("picture")

        # Find user by google_id
        statement = select(User).where(User.google_id == google_id)
        result = await session.execute(statement)
        user = result.scalar_one_or_none()

        if not user:
            # Fallback: check by email
            statement = select(User).where(User.email == email)
            result = await session.execute(statement)
            user = result.scalar_one_or_none()

            if not user:
                # Create new user
                user = User(
                    email=email,
                    google_id=google_id,
                    google_name=name,
                    google_avatar=avatar,
                    subscription_tier="free",
                )
                session.add(user)
            else:
                # Link Google account
                user.google_id = google_id
                user.google_name = name
                user.google_avatar = avatar
        else:
            # Update Google profile info
            user.google_name = name
            user.google_avatar = avatar

        await session.commit()
        await session.refresh(user)

        # Create JWT
        access_token = create_access_token({"sub": str(user.id), "email": user.email})

        # Redirect with secure cookie instead of query param
        response = RedirectResponse(FRONTEND_URL)
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="Lax",
            max_age=3600,  # 1 hour
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Google OAuth failed")
        raise HTTPException(status_code=500, detail="Google OAuth failed")
