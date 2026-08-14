"""DNS record endpoints, always scoped to one hosted zone."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import auth, models
from ..database import get_db
from ..dns_rules import RECORD_TYPES, ValidationProblem, validate_record
from ..schemas import DnsRecordCreate, DnsRecordOut, DnsRecordUpdate, Page, User

router = APIRouter(prefix="/api/zones/{zone_id}/records", tags=["dns records"])


def _zone_or_404(db: Session, zone_id: str) -> models.HostedZone:
    zone = db.get(models.HostedZone, zone_id)
    if zone is None:
        raise HTTPException(404, f"Hosted zone {zone_id} was not found.")
    return zone


def _to_out(record: models.DnsRecord) -> DnsRecordOut:
    return DnsRecordOut(
        id=record.id,
        zone_id=record.zone_id,
        name=record.name,
        type=record.type,
        ttl=record.ttl,
        values=record.value.splitlines() if record.value else [],
        routing_policy=record.routing_policy,
        is_system=record.is_system,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _full_name(zone_name: str, name: str) -> str:
    """
    Turn what the user typed into a full record name.

    Typing "www" in a zone for example.com means www.example.com.
    Leaving it blank means the zone itself (the apex record).
    Typing the whole thing already is fine too.
    """
    name = name.strip().lower().rstrip(".")
    if not name:
        return zone_name
    if name == zone_name or name.endswith("." + zone_name):
        return name
    return f"{name}.{zone_name}"


@router.get("", response_model=Page[DnsRecordOut])
def list_records(
    zone_id: str,
    search: str = Query("", description="Match against record name or value"),
    type: str = Query("", description="Filter by record type, e.g. A"),
    sort: str = Query("name", pattern="^(name|type|ttl|updated_at)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    _zone_or_404(db, zone_id)

    query = select(models.DnsRecord).where(models.DnsRecord.zone_id == zone_id)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            models.DnsRecord.name.ilike(pattern) | models.DnsRecord.value.ilike(pattern)
        )
    if type:
        query = query.where(models.DnsRecord.type == type)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    column = getattr(models.DnsRecord, sort)
    query = query.order_by(column.desc() if order == "desc" else column.asc())
    records = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()

    return Page[DnsRecordOut](
        items=[_to_out(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, -(-total // page_size)),
    )


@router.post("", response_model=DnsRecordOut, status_code=201)
def create_record(
    zone_id: str,
    body: DnsRecordCreate,
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    zone = _zone_or_404(db, zone_id)
    name = _full_name(zone.name, body.name)

    try:
        values = validate_record(body.type, name, body.value, body.ttl)
    except ValidationProblem as problem:
        raise HTTPException(422, str(problem))

    clash = db.scalar(
        select(models.DnsRecord).where(
            models.DnsRecord.zone_id == zone_id,
            models.DnsRecord.name == name,
            models.DnsRecord.type == body.type,
        )
    )
    if clash:
        raise HTTPException(409, f"A {body.type} record for {name} already exists.")

    # DNS rule: a name with a CNAME cannot have any other record type.
    others = db.scalars(
        select(models.DnsRecord).where(
            models.DnsRecord.zone_id == zone_id, models.DnsRecord.name == name
        )
    ).all()
    if body.type == "CNAME" and others:
        raise HTTPException(409, f"{name} already has other records, so it cannot have a CNAME.")
    if any(r.type == "CNAME" for r in others):
        raise HTTPException(409, f"{name} has a CNAME, so it cannot have other records.")

    record = models.DnsRecord(
        zone_id=zone_id,
        name=name,
        type=body.type,
        ttl=body.ttl,
        value="\n".join(values),
        routing_policy=body.routing_policy,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_out(record)


@router.get("/{record_id}", response_model=DnsRecordOut)
def get_record(
    zone_id: str, record_id: int,
    db: Session = Depends(get_db), user: User = auth.LoggedIn,
):
    record = db.get(models.DnsRecord, record_id)
    if record is None or record.zone_id != zone_id:
        raise HTTPException(404, "Record was not found in this hosted zone.")
    return _to_out(record)


@router.put("/{record_id}", response_model=DnsRecordOut)
def update_record(
    zone_id: str,
    record_id: int,
    body: DnsRecordUpdate,
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    """Name and type identify a record, so only TTL and value can change."""
    record = db.get(models.DnsRecord, record_id)
    if record is None or record.zone_id != zone_id:
        raise HTTPException(404, "Record was not found in this hosted zone.")
    if record.is_system:
        raise HTTPException(409, f"The default {record.type} record cannot be edited.")

    try:
        values = validate_record(record.type, record.name, body.value, body.ttl)
    except ValidationProblem as problem:
        raise HTTPException(422, str(problem))

    record.ttl = body.ttl
    record.value = "\n".join(values)
    record.routing_policy = body.routing_policy
    db.commit()
    db.refresh(record)
    return _to_out(record)


@router.delete("/{record_id}", status_code=204)
def delete_record(
    zone_id: str, record_id: int,
    db: Session = Depends(get_db), user: User = auth.LoggedIn,
):
    record = db.get(models.DnsRecord, record_id)
    if record is None or record.zone_id != zone_id:
        raise HTTPException(404, "Record was not found in this hosted zone.")
    if record.is_system:
        raise HTTPException(409, f"The default {record.type} record cannot be deleted.")

    db.delete(record)
    db.commit()


class BulkDeleteRequest(BaseModel):
    ids: list[int]


class BulkDeleteResult(BaseModel):
    deleted: int
    # Records we refused to touch, with the reason, e.g.
    # "The default NS record cannot be deleted."
    skipped: list[str]


@router.post("/bulk-delete", response_model=BulkDeleteResult)
def bulk_delete_records(
    zone_id: str,
    body: BulkDeleteRequest,
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    """
    Delete several records in one go.

    Protected records are reported back rather than failing the whole
    request, so selecting everything and hitting delete does the sensible
    thing instead of erroring.
    """
    _zone_or_404(db, zone_id)

    if not body.ids:
        raise HTTPException(422, "No records were selected.")

    records = db.scalars(
        select(models.DnsRecord).where(
            models.DnsRecord.zone_id == zone_id,
            models.DnsRecord.id.in_(body.ids),
        )
    ).all()

    found = {r.id for r in records}
    skipped = [f"Record {i} was not found in this zone." for i in body.ids if i not in found]

    deleted = 0
    for record in records:
        if record.is_system:
            skipped.append(f"{record.name} ({record.type}) is a default record and was kept.")
            continue
        db.delete(record)
        deleted += 1

    db.commit()
    return BulkDeleteResult(deleted=deleted, skipped=skipped)
