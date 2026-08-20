"""
Mocked authentication.

The assignment allows auth to be faked, so this is deliberately simple: any
email plus any password of at least four characters signs you in.

**Tokens are stateless.** Rather than keeping a dictionary of live sessions in
memory, the token *is* the session: it carries the user's email and an expiry,
signed with a secret key. Verifying a token means re-computing the signature,
not looking anything up.

That matters for deployment. On a serverless host every request can land on a
different instance with its own memory, so a server-side session dictionary
would appear to work at login and then randomly fail on the next request.
A signed token works identically on any instance.

It behaves like a real token API from the frontend's point of view, so swapping
in proper authentication means changing only this file.
"""

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, Header, HTTPException, status

from .schemas import User

# In production this must be set. The fallback keeps local development working
# with no configuration, and is fine here because auth is mocked anyway.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-secret-not-for-production")

TOKEN_LIFETIME_SECONDS = 12 * 60 * 60  # 12 hours


def _sign(payload: bytes) -> str:
    return hmac.new(SECRET_KEY.encode(), payload, hashlib.sha256).hexdigest()


def _encode(user: User) -> str:
    """Build a token: base64(payload).signature"""
    payload = json.dumps(
        {
            "email": user.email,
            "name": user.display_name,
            "account": user.account_id,
            "exp": int(time.time()) + TOKEN_LIFETIME_SECONDS,
        },
        separators=(",", ":"),
    ).encode()

    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=")
    return f"{encoded.decode()}.{_sign(encoded)}"


def _decode(token: str) -> User | None:
    """Return the user if the token is genuine and unexpired, otherwise None."""
    try:
        encoded, signature = token.rsplit(".", 1)
    except ValueError:
        return None

    # compare_digest rather than == so the comparison takes the same time
    # whether the signature is wrong in the first byte or the last. A plain
    # == leaks, through timing, how much of a guess was correct.
    if not hmac.compare_digest(_sign(encoded.encode()), signature):
        return None

    try:
        padding = "=" * (-len(encoded) % 4)
        data = json.loads(base64.urlsafe_b64decode(encoded + padding))
    except (ValueError, json.JSONDecodeError):
        return None

    if data.get("exp", 0) < time.time():
        return None

    return User(
        email=data["email"],
        display_name=data["name"],
        account_id=data["account"],
    )


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
    return _encode(user), user


def logout(token: str) -> None:
    """
    Signing out is handled on the client, which deletes its copy of the token.

    A stateless token cannot truly be revoked without shared storage to hold a
    denylist. For real authentication I would keep short-lived access tokens
    plus a revocation list in Redis or the database. Left out here because auth
    is mocked, but worth knowing the limitation rather than pretending the
    endpoint does more than it does.
    """
    return None


def current_user(authorization: str | None = Header(default=None)) -> User:
    """
    FastAPI dependency for protected routes.
    Expects the standard 'Authorization: Bearer <token>' header.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in.")

    user = _decode(authorization.split(" ", 1)[1].strip())
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    return user


# Short alias so routers read nicely: user: User = LoggedIn
LoggedIn = Depends(current_user)
