"""
Database setup.

The app runs on either SQLite or PostgreSQL, decided entirely by the
DATABASE_URL environment variable:

    unset                                  -> backend/route53.db (SQLite)
    postgresql://user:pass@host/db         -> that Postgres server
    sqlite:////data/route53.db             -> SQLite at an explicit path

SQLite is the default because it needs no setup, which is what you want
when running the project locally. A hosted deployment points DATABASE_URL
at a managed Postgres so the data survives redeploys.

Nothing else in the codebase knows or cares which one is in use.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Default: a file sitting next to this code.
DEFAULT_SQLITE_FILE = Path(__file__).resolve().parent.parent / "route53.db"


def _normalise(url: str) -> str:
    """
    Hosting providers hand out URLs starting with "postgres://", which is an
    old alias SQLAlchemy no longer accepts. We also pin the driver to psycopg
    version 3, since that is what requirements.txt installs.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _normalise(os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_FILE}"))

IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    # SQLite refuses to be used from more than one thread by default.
    # FastAPI runs handlers in a thread pool, so we turn that check off.
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(
        DATABASE_URL,
        # Free-tier Postgres often sleeps when idle and drops open connections.
        # pool_pre_ping tests a connection before handing it out, so the first
        # request after a quiet spell reconnects instead of erroring.
        pool_pre_ping=True,
        pool_recycle=300,
        # Keep the pool small: serverless Postgres plans cap connections.
        pool_size=5,
        max_overflow=5,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Parent class every table model inherits from."""


def get_db():
    """
    FastAPI dependency. Opens a database session for one request and
    always closes it afterwards, even if the handler raised.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
