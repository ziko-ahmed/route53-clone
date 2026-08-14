"""
Request and response shapes.

Pydantic checks incoming JSON against these classes before our code runs,
and uses them to serialise what we send back.
"""

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


# ----- auth -----

class LoginRequest(BaseModel):
    email: str
    password: str


class User(BaseModel):
    email: str
    display_name: str
    account_id: str


class LoginResponse(BaseModel):
    token: str
    user: User


# ----- hosted zones -----

class HostedZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, examples=["example.com"])
    comment: str = ""
    type: str = Field(default="Public", pattern="^(Public|Private)$")


class HostedZoneUpdate(BaseModel):
    """Only the comment is editable, same as the real Route53 console."""
    comment: str = ""


class HostedZoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    comment: str
    type: str
    name_servers: list[str]
    record_count: int
    created_at: datetime


# ----- dns records -----

class DnsRecordCreate(BaseModel):
    # Blank means the zone's own domain (the "apex" record), so no min_length.
    name: str = Field(default="", max_length=255)
    type: str
    ttl: int = 300
    # Several values are entered one per line, like the AWS console text box.
    value: str
    routing_policy: str = "Simple"


class DnsRecordUpdate(BaseModel):
    ttl: int = 300
    value: str
    routing_policy: str = "Simple"


class DnsRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: str
    name: str
    type: str
    ttl: int
    values: list[str]
    routing_policy: str
    is_system: bool
    created_at: datetime
    updated_at: datetime


# ----- pagination -----

class Page(BaseModel, Generic[T]):
    """A slice of a longer list, plus the numbers the UI needs to draw pagination."""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
