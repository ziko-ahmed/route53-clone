"""
Mocked authentication.

Any email plus any password of at least 4 characters logs you in, and we
hand back an opaque token we keep in memory.

It behaves like a real token API from the frontend's point of view --
login returns a token, protected routes need it, logout invalidates it --
so swapping in real auth later means changing only this file.
"""

import secrets

from fastapi import Depends, Header, HTTPException, status

from .schemas import User

# token -> user. In-memory, so restarting the server logs everyone out.
_SESSIONS: dict[str, User] = {}


def login(email: str, password: str) -> tuple[str, User]:
    if "@" not in email or len(password) < 4:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Enter an email address and a password of at least 4 characters.",
        )

    user = User(
        email=email,
        display_name=email.split("@")[0],
        # A fake 12-digit AWS account number, shown in the top-right menu.
        account_id="4815162342" + str(abs(hash(email)) % 100).zfill(2),
    )
    token = secrets.token_urlsafe(24)
    _SESSIONS[token] = user
    return token, user


def logout(token: str) -> None:
    _SESSIONS.pop(token, None)


def current_user(authorization: str | None = Header(default=None)) -> User:
    """
    FastAPI dependency for protected routes.
    Expects the standard 'Authorization: Bearer <token>' header.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in.")

    token = authorization.split(" ", 1)[1].strip()
    user = _SESSIONS.get(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    return user


# Short alias so routers read nicely: user: User = LoggedIn
LoggedIn = Depends(current_user)
