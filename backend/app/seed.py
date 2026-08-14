"""
Sample data.

Runs once on first start so the app is not an empty screen. If the
database already has zones, this does nothing.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .routers.zones import _name_servers, _new_zone_id

# (domain, comment, [(record name, type, ttl, value), ...])
SAMPLE = [
    (
        "example.com",
        "Primary marketing site",
        [
            ("example.com", "A", 300, "192.0.2.10\n192.0.2.11"),
            ("www.example.com", "CNAME", 300, "example.com"),
            ("api.example.com", "A", 60, "198.51.100.24"),
            ("example.com", "MX", 3600, "10 inbound.mail.example.com\n20 backup.mail.example.com"),
            ("example.com", "TXT", 300, '"v=spf1 include:_spf.example.com ~all"'),
            ("ipv6.example.com", "AAAA", 300, "2001:db8::1"),
            ("example.com", "CAA", 3600, '0 issue "amazon.com"'),
            ("_sip._tcp.example.com", "SRV", 300, "1 10 5060 sip.example.com"),
        ],
    ),
    (
        "shop.example.net",
        "Storefront and checkout",
        [
            ("shop.example.net", "A", 60, "203.0.113.5"),
            ("checkout.shop.example.net", "CNAME", 300, "shop.example.net"),
            ("shop.example.net", "TXT", 300, '"google-site-verification=abc123"'),
        ],
    ),
    (
        "internal.example.org",
        "Private zone for internal services",
        [
            ("db.internal.example.org", "A", 300, "10.0.1.20"),
            ("cache.internal.example.org", "A", 300, "10.0.1.21"),
        ],
    ),
    ("staging.example.io", "Staging environment", []),
    ("blog.example.dev", "Company blog", [
        ("blog.example.dev", "A", 300, "192.0.2.99"),
    ]),
]


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(models.HostedZone).limit(1)):
        return

    for domain, comment, records in SAMPLE:
        zone_id = _new_zone_id()
        servers = _name_servers(zone_id)
        zone_type = "Private" if domain.startswith("internal.") else "Public"

        zone = models.HostedZone(
            id=zone_id,
            name=domain,
            comment=comment,
            type=zone_type,
            name_servers="\n".join(servers),
        )
        zone.records = [
            models.DnsRecord(name=domain, type="NS", ttl=172800,
                             value="\n".join(servers), is_system=True),
            models.DnsRecord(
                name=domain, type="SOA", ttl=900, is_system=True,
                value=f"{servers[0]}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
            ),
        ] + [
            models.DnsRecord(name=n, type=t, ttl=ttl, value=v)
            for n, t, ttl, v in records
        ]
        db.add(zone)

    db.commit()
