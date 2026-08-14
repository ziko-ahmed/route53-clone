"""Sign in, sign out, and 'who am I'."""

from fastapi import APIRouter, Header

from .. import auth
from ..schemas import LoginRequest, LoginResponse, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    token, user = auth.login(body.email, body.password)
    return LoginResponse(token=token, user=user)


@router.post("/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        auth.logout(authorization.split(" ", 1)[1].strip())


@router.get("/me", response_model=User)
def me(user: User = auth.LoggedIn):
    """The frontend calls this on load to restore the session after a refresh."""
    return user
