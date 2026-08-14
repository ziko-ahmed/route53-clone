"""
Database setup.

We use SQLite through SQLAlchemy. Everything lives in a single file
(route53.db) that sits next to this code, so there is nothing to install
or configure -- you just run the app and the file appears.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# By default the .db file lives in backend/route53.db.
# Set DATABASE_URL to put it somewhere else -- a mounted disk in production,
# or "sqlite:///:memory:" in tests.
DB_FILE = Path(__file__).resolve().parent.parent / "route53.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_FILE}")

engine = create_engine(
    DATABASE_URL,
    # SQLite refuses to be used from more than one thread by default.
    # FastAPI runs handlers in a thread pool, so we turn that check off.
    connect_args={"check_same_thread": False},
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
