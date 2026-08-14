"""Hosted zone endpoints: list, read, create, update, delete."""

import random
import string

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import auth, models
from ..database import get_db
from ..dns_rules import ValidationProblem, is_hostname
from ..schemas import HostedZoneCreate, HostedZoneOut, HostedZoneUpdate, Page, User

router = APIRouter(prefix="/api/zones", tags=["hosted zones"])

_ALPHABET = string.ascii_uppercase + string.digits


def _new_zone_id() -> str:
    """Route53 zone ids look like Z1D633PJN98FT9 -- Z plus 13 characters."""
    return "Z" + "".join(random.choices(_ALPHABET, k=13))


def _name_servers(zone_id: str) -> list[str]:
    """Four fake but stable-looking AWS name servers for this zone."""
    seed = random.Random(zone_id)
    tlds = ["com", "org", "net", "co.uk"]
    return [
        f"ns-{seed.randint(100, 2047)}.awsdns-{seed.randint(0, 63):02d}.{tld}"
        for tld in tlds
    ]


def _normalise_domain(name: str) -> str:
    """Trim spaces, lowercase, and drop any trailing dot the user typed."""
    return name.strip().lower().rstrip(".")


def _to_out(zone: models.HostedZone) -> HostedZoneOut:
    return HostedZoneOut(
        id=zone.id,
        name=zone.name,
        comment=zone.comment,
        type=zone.type,
        name_servers=zone.name_servers.splitlines() if zone.name_servers else [],
        record_count=len(zone.records),
        created_at=zone.created_at,
    )


def _get_or_404(db: Session, zone_id: str) -> models.HostedZone:
    zone = db.get(models.HostedZone, zone_id)
    if zone is None:
        raise HTTPException(404, f"Hosted zone {zone_id} was not found.")
    return zone


@router.get("", response_model=Page[HostedZoneOut])
def list_zones(
    search: str = Query("", description="Match against the domain name"),
    type: str = Query("", description="Filter by Public or Private"),
    sort: str = Query("name", pattern="^(name|created_at|record_count)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    query = select(models.HostedZone)

    if search:
        query = query.where(models.HostedZone.name.ilike(f"%{search.strip()}%"))
    if type:
        query = query.where(models.HostedZone.type == type)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    # record_count is derived, not a column, so we sort it in Python below.
    if sort != "record_count":
        column = getattr(models.HostedZone, sort)
        query = query.order_by(column.desc() if order == "desc" else column.asc())
        zones = db.scalars(
            query.offset((page - 1) * page_size).limit(page_size)
        ).all()
        items = [_to_out(z) for z in zones]
    else:
        items = [_to_out(z) for z in db.scalars(query).all()]
        items.sort(key=lambda z: z.record_count, reverse=(order == "desc"))
        items = items[(page - 1) * page_size : page * page_size]

    return Page[HostedZoneOut](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, -(-total // page_size)),  # ceiling division
    )


@router.post("", response_model=HostedZoneOut, status_code=201)
def create_zone(
    body: HostedZoneCreate,
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    name = _normalise_domain(body.name)
    if not is_hostname(name) or "." not in name:
        raise HTTPException(422, f"'{body.name}' is not a valid domain name.")

    already = db.scalar(
        select(models.HostedZone).where(
            models.HostedZone.name == name, models.HostedZone.type == body.type
        )
    )
    if already:
        raise HTTPException(409, f"A {body.type.lower()} hosted zone for {name} already exists.")

    zone_id = _new_zone_id()
    servers = _name_servers(zone_id)
    zone = models.HostedZone(
        id=zone_id,
        name=name,
        comment=body.comment.strip(),
        type=body.type,
        name_servers="\n".join(servers),
    )

    # Route53 creates an NS and an SOA record with every new zone.
    zone.records = [
        models.DnsRecord(
            name=name, type="NS", ttl=172800,
            value="\n".join(servers), is_system=True,
        ),
        models.DnsRecord(
            name=name, type="SOA", ttl=900, is_system=True,
            value=f"{servers[0]}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
        ),
    ]

    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _to_out(zone)


@router.get("/{zone_id}", response_model=HostedZoneOut)
def get_zone(zone_id: str, db: Session = Depends(get_db), user: User = auth.LoggedIn):
    return _to_out(_get_or_404(db, zone_id))


@router.patch("/{zone_id}", response_model=HostedZoneOut)
def update_zone(
    zone_id: str,
    body: HostedZoneUpdate,
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    zone = _get_or_404(db, zone_id)
    zone.comment = body.comment.strip()
    db.commit()
    db.refresh(zone)
    return _to_out(zone)


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: str, db: Session = Depends(get_db), user: User = auth.LoggedIn):
    zone = _get_or_404(db, zone_id)

    # Route53 will not delete a zone that still has records you created.
    user_records = [r for r in zone.records if not r.is_system]
    if user_records:
        raise HTTPException(
            409,
            f"Delete the {len(user_records)} record(s) in this zone first. "
            "Only the default NS and SOA records may remain.",
        )

    db.delete(zone)
    db.commit()
