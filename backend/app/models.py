"""
Database tables.

Two tables do the real work:

    hosted_zones   one row per domain you manage (example.com)
    dns_records    one row per DNS record inside a zone (www.example.com A ...)

A zone owns its records: deleting a zone deletes its records with it.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class HostedZone(Base):
    """A domain you manage, e.g. example.com."""

    __tablename__ = "hosted_zones"

    # Route53 zone ids look like "Z1D633PJN98FT9". We generate the same shape.
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    comment: Mapped[str] = mapped_column(Text, default="")

    # "Public" is reachable from the internet, "Private" is VPC-only.
    # We only store the label -- no real DNS is served either way.
    type: Mapped[str] = mapped_column(String(16), default="Public")

    # The four authoritative name servers AWS would hand you.
    # Stored as one string, newline separated, to keep the schema simple.
    name_servers: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    records: Mapped[list["DnsRecord"]] = relationship(
        back_populates="zone",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (UniqueConstraint("name", "type", name="uq_zone_name_type"),)


class DnsRecord(Base):
    """A single DNS record inside a hosted zone."""

    __tablename__ = "dns_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    ttl: Mapped[int] = mapped_column(Integer, default=300)

    # A record can hold several values (e.g. two A records for one name).
    # We store them newline separated, exactly how the AWS console shows them.
    value: Mapped[str] = mapped_column(Text, default="")

    routing_policy: Mapped[str] = mapped_column(String(32), default="Simple")

    # NS and SOA records that AWS creates for you cannot be deleted.
    # We mark those rows so the API can refuse to remove them.
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    zone: Mapped[HostedZone] = relationship(back_populates="records")

    # DNS allows only one record per (name, type) pair within a zone.
    __table_args__ = (
        UniqueConstraint("zone_id", "name", "type", name="uq_record_zone_name_type"),
    )
