"""
Application entry point.

Run it with:   uvicorn app.main:app --reload --port 8000
Interactive API docs are then at http://localhost:8000/docs
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .dns_rules import RECORD_TYPES
from .routers import auth as auth_router
from .routers import records, transfer, zones
from .seed import seed_if_empty

app = FastAPI(
    title="Route53 Clone API",
    description="A small DNS-management API that mirrors the AWS Route53 console.",
    version="1.0.0",
)

# The Next.js dev server runs on a different port, so the browser needs
# permission to call us. Set ALLOWED_ORIGINS in production.
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(zones.router)
app.include_router(records.router)
app.include_router(transfer.router)


@app.on_event("startup")
def startup() -> None:
    """
    Create the tables if they do not exist, then add sample data once.

    Safe to run repeatedly: create_all skips tables that already exist, and
    seeding is a no-op once there is any data. That matters on serverless
    hosts, where this runs on every cold start rather than once.
    """
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_if_empty(db)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/api/record-types", tags=["meta"])
def record_types():
    """The record types the UI offers, with the hint shown under each field."""
    return [{"type": t, "hint": hint} for t, hint in RECORD_TYPES.items()]
