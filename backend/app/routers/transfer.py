"""
Importing and exporting a zone.

Import reads a BIND zone file. Export writes one back out, or gives you the
same data as JSON.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import auth, models
from ..bind import export_zone_file, parse_zone_file
from ..database import get_db
from ..dns_rules import ValidationProblem, validate_record
from ..schemas import User

router = APIRouter(prefix="/api/zones/{zone_id}", tags=["import / export"])


class ImportRequest(BaseModel):
    # The whole zone file as one string.
    content: str
    # If a record already exists, overwrite it rather than skipping it.
    overwrite: bool = False


class ImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    # Plain-English notes about anything that did not import cleanly.
    warnings: list[str]


def _zone_or_404(db: Session, zone_id: str) -> models.HostedZone:
    zone = db.get(models.HostedZone, zone_id)
    if zone is None:
        raise HTTPException(404, f"Hosted zone {zone_id} was not found.")
    return zone


@router.post("/import", response_model=ImportResult)
def import_zone_file(
    zone_id: str,
    body: ImportRequest,
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    """
    Read a BIND zone file and add its records to this zone.

    Anything that cannot be imported becomes a warning rather than an error,
    so one bad line does not throw away the other forty.
    """
    zone = _zone_or_404(db, zone_id)

    if not body.content.strip():
        raise HTTPException(422, "The zone file is empty.")

    parsed = parse_zone_file(body.content, zone.name)
    warnings = list(parsed.warnings)

    # A zone file lists each value on its own line, but our storage keeps one
    # row per name+type with the values stacked inside it. So merge first.
    merged: dict[tuple[str, str], dict] = {}
    for record in parsed.records:
        key = (record.name, record.type)
        if key in merged:
            merged[key]["values"].append(record.value)
        else:
            merged[key] = {"ttl": record.ttl, "values": [record.value]}

    existing = {
        (r.name, r.type): r
        for r in db.scalars(
            select(models.DnsRecord).where(models.DnsRecord.zone_id == zone_id)
        ).all()
    }

    created = updated = skipped = 0

    for (name, record_type), data in merged.items():
        value = "\n".join(data["values"])

        try:
            values = validate_record(record_type, name, value, data["ttl"])
        except ValidationProblem as problem:
            warnings.append(f"{name} ({record_type}): {problem}")
            skipped += 1
            continue

        current = existing.get((name, record_type))

        if current is not None:
            if current.is_system:
                # The NS and SOA records belong to the app, not the file.
                skipped += 1
                continue
            if not body.overwrite:
                warnings.append(
                    f"{name} ({record_type}) already exists and was left alone. "
                    "Tick 'overwrite existing records' to replace it."
                )
                skipped += 1
                continue
            current.ttl = data["ttl"]
            current.value = "\n".join(values)
            updated += 1
            continue

        # A name with a CNAME cannot hold anything else, in either direction.
        clash = [key for key in list(existing) + list(merged) if key[0] == name]
        if record_type == "CNAME" and any(k[1] != "CNAME" for k in clash):
            warnings.append(f"{name}: skipped the CNAME because the name has other records.")
            skipped += 1
            continue
        if record_type != "CNAME" and any(
            k[1] == "CNAME" for k in clash if k in existing
        ):
            warnings.append(f"{name}: skipped the {record_type} because the name has a CNAME.")
            skipped += 1
            continue

        record = models.DnsRecord(
            zone_id=zone_id,
            name=name,
            type=record_type,
            ttl=data["ttl"],
            value="\n".join(values),
        )
        db.add(record)
        existing[(name, record_type)] = record
        created += 1

    db.commit()
    return ImportResult(created=created, updated=updated, skipped=skipped, warnings=warnings)


@router.get("/export")
def export_zone(
    zone_id: str,
    format: str = Query("bind", pattern="^(bind|json)$"),
    db: Session = Depends(get_db),
    user: User = auth.LoggedIn,
):
    """Download the zone as a BIND zone file or as JSON."""
    zone = _zone_or_404(db, zone_id)
    records = sorted(zone.records, key=lambda r: (r.name, r.type))

    if format == "json":
        return {
            "hosted_zone": {
                "id": zone.id,
                "name": zone.name,
                "comment": zone.comment,
                "type": zone.type,
                "name_servers": zone.name_servers.splitlines(),
            },
            "records": [
                {
                    "name": r.name,
                    "type": r.type,
                    "ttl": r.ttl,
                    "values": r.value.splitlines(),
                }
                for r in records
            ],
        }

    text = export_zone_file(zone.name, zone.name_servers.splitlines(), records)
    return PlainTextResponse(
        text,
        headers={"Content-Disposition": f'attachment; filename="{zone.name}.zone"'},
    )
