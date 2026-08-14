"""
DNS rules: which record types exist, and what a valid value looks like
for each of them.

Kept in one file on purpose -- if you want to support a new record type,
this is the only place you need to touch.
"""

import ipaddress
import re

# Every record type the app supports, with the help text the UI shows.
RECORD_TYPES: dict[str, str] = {
    "A": "IPv4 address, e.g. 192.0.2.1",
    "AAAA": "IPv6 address, e.g. 2001:db8::1",
    "CNAME": "Another domain name, e.g. example.com",
    "TXT": "Free text, e.g. \"v=spf1 include:_spf.example.com ~all\"",
    "MX": "Priority then mail server, e.g. 10 mail.example.com",
    "NS": "Name server, e.g. ns-1.awsdns-00.com",
    "PTR": "Domain name for a reverse lookup, e.g. host.example.com",
    "SRV": "Priority weight port target, e.g. 1 10 5269 server.example.com",
    "CAA": "Flags tag value, e.g. 0 issue \"amazon.com\"",
}

# A hostname label: letters, digits and hyphens, up to 63 characters.
# The full name is those labels joined by dots, optionally ending in a dot.
# "*" is allowed as the first label for wildcard records.
_HOSTNAME = re.compile(
    r"^(\*\.)?([a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*"
    r"[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.?$"
)

TTL_MIN, TTL_MAX = 0, 2_147_483_647


class ValidationProblem(Exception):
    """Raised when a record value does not match its type."""


def is_hostname(value: str) -> bool:
    return bool(value) and len(value) <= 255 and bool(_HOSTNAME.match(value))


def _check_one(record_type: str, line: str) -> None:
    """Validate a single value line. Raises ValidationProblem if it is wrong."""

    if record_type == "A":
        try:
            ipaddress.IPv4Address(line)
        except ValueError:
            raise ValidationProblem(f"'{line}' is not a valid IPv4 address.")

    elif record_type == "AAAA":
        try:
            ipaddress.IPv6Address(line)
        except ValueError:
            raise ValidationProblem(f"'{line}' is not a valid IPv6 address.")

    elif record_type in ("CNAME", "NS", "PTR"):
        if not is_hostname(line):
            raise ValidationProblem(f"'{line}' is not a valid domain name.")

    elif record_type == "TXT":
        if len(line) > 4000:
            raise ValidationProblem("TXT value is too long (max 4000 characters).")

    elif record_type == "MX":
        # Format: <priority 0-65535> <mail server>
        parts = line.split()
        if len(parts) != 2:
            raise ValidationProblem(
                "MX must be a priority and a mail server, e.g. '10 mail.example.com'."
            )
        priority, host = parts
        if not priority.isdigit() or not 0 <= int(priority) <= 65535:
            raise ValidationProblem("MX priority must be a number between 0 and 65535.")
        if not is_hostname(host):
            raise ValidationProblem(f"'{host}' is not a valid mail server name.")

    elif record_type == "SRV":
        # Format: <priority> <weight> <port> <target>
        parts = line.split()
        if len(parts) != 4:
            raise ValidationProblem(
                "SRV must be 'priority weight port target', "
                "e.g. '1 10 5269 server.example.com'."
            )
        *numbers, target = parts
        labels = ("priority", "weight", "port")
        for label, number in zip(labels, numbers):
            if not number.isdigit() or not 0 <= int(number) <= 65535:
                raise ValidationProblem(
                    f"SRV {label} must be a number between 0 and 65535."
                )
        if not is_hostname(target):
            raise ValidationProblem(f"'{target}' is not a valid target name.")

    elif record_type == "CAA":
        # Format: <flags 0-255> <tag> "<value>"
        parts = line.split(maxsplit=2)
        if len(parts) != 3:
            raise ValidationProblem(
                "CAA must be 'flags tag \"value\"', e.g. '0 issue \"amazon.com\"'."
            )
        flags, tag, _value = parts
        if not flags.isdigit() or not 0 <= int(flags) <= 255:
            raise ValidationProblem("CAA flags must be a number between 0 and 255.")
        if tag not in ("issue", "issuewild", "iodef"):
            raise ValidationProblem("CAA tag must be issue, issuewild or iodef.")


def validate_record(record_type: str, name: str, value: str, ttl: int) -> list[str]:
    """
    Check a whole record and return its values as a cleaned-up list.

    Raises ValidationProblem with a plain-English message on the first error,
    which the API turns into a 422 response the UI can display as-is.
    """
    if record_type not in RECORD_TYPES:
        raise ValidationProblem(f"'{record_type}' is not a supported record type.")

    if not is_hostname(name):
        raise ValidationProblem(f"'{name}' is not a valid record name.")

    if not TTL_MIN <= ttl <= TTL_MAX:
        raise ValidationProblem(f"TTL must be between {TTL_MIN} and {TTL_MAX} seconds.")

    lines = [line.strip() for line in value.splitlines() if line.strip()]
    if not lines:
        raise ValidationProblem("Value cannot be empty.")

    # CNAME is special: a name with a CNAME cannot have any other record,
    # so more than one value is never valid.
    if record_type == "CNAME" and len(lines) > 1:
        raise ValidationProblem("A CNAME record can only have one value.")

    for line in lines:
        _check_one(record_type, line)

    return lines
