"""Clerk session verification and the local user record it maps to."""

import logging
from typing import Any

from clerk_backend_api import Clerk
from clerk_backend_api.security import (
    AuthenticateRequestOptions,
    authenticate_request_async,
)
from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from config import CLERK_AUTHORIZED_PARTIES, CLERK_SECRET_KEY, FREE_CREDITS
from database import get_session
from models import User

logger = logging.getLogger(__name__)

_auth_options = AuthenticateRequestOptions(
    secret_key=CLERK_SECRET_KEY or None,
    authorized_parties=CLERK_AUTHORIZED_PARTIES or None,
)

_clerk = Clerk(bearer_auth=CLERK_SECRET_KEY) if CLERK_SECRET_KEY else None


async def _clerk_profile(user_id: str) -> dict[str, Any]:
    """Email and display name are not in the session token by default."""
    if _clerk is None:
        return {}

    try:
        clerk_user = await _clerk.users.get_async(user_id=user_id)
    except Exception:  # network hiccup should not block sign-in
        logger.warning("Could not fetch Clerk profile for %s", user_id, exc_info=True)
        return {}

    emails = [
        address
        for address in (clerk_user.email_addresses or [])
        if getattr(address, "email_address", None)
    ]
    primary = next(
        (address for address in emails if address.id == clerk_user.primary_email_address_id),
        emails[0] if emails else None,
    )
    name = " ".join(
        part for part in (clerk_user.first_name, clerk_user.last_name) if part
    ).strip()

    return {
        "email": primary.email_address if primary else "",
        "name": name or clerk_user.username or None,
        "image_url": clerk_user.image_url,
    }


async def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
) -> User:
    """Verify the Clerk session token and return the matching local user.

    The row is created on first sight, so no webhook or sync job is needed.
    """
    if _clerk is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AUTH_NOT_CONFIGURED",
                "message": "CLERK_SECRET_KEY is not set on the server.",
            },
        )

    try:
        state = await authenticate_request_async(request, _auth_options)
    except Exception:
        logger.warning("Clerk request verification failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify your session.",
        ) from None

    if not state.is_signed_in or not state.payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
        )

    claims = state.payload
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token is missing a subject.",
        )

    user = session.get(User, user_id)

    if user is None:
        profile = await _clerk_profile(user_id)
        user = User(
            id=user_id,
            email=profile.get("email") or claims.get("email") or "",
            name=profile.get("name"),
            image_url=profile.get("image_url"),
            credits=FREE_CREDITS,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        logger.info("Created local user %s", user_id)
        return user

    if not user.email or not user.name:
        profile = await _clerk_profile(user_id)
        if profile:
            user.email = user.email or profile.get("email") or ""
            user.name = user.name or profile.get("name")
            user.image_url = user.image_url or profile.get("image_url")
            session.add(user)
            session.commit()
            session.refresh(user)

    return user
