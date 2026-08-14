# Route 53 Clone

A working clone of the AWS Route 53 console. You can sign in, create hosted
zones for your domains, and manage the DNS records inside them. Everything is
saved to a SQLite database, so it is still there when you come back.

It looks and behaves like the real AWS console, but it does not answer real DNS
queries — the point is the interface and the data model, not running DNS.

It runs on **SQLite locally** (nothing to install) and on **PostgreSQL when
deployed** (so the hosted demo keeps its data). Which one is used is decided by
a single environment variable; no code changes.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Setup](#setup)
3. [Architecture](#architecture)
4. [Database schema](#database-schema)
5. [API overview](#api-overview)
6. [Bonus features](#bonus-features)
7. [Design notes](#design-notes)
8. [Project structure](#project-structure)

---

## What it does

**Sign in** — mocked, as the assignment allows. Any email address and any
password of four or more characters works. The session survives a page refresh.

**Hosted zones** — create, view, search, filter by public/private, sort, edit
the description, and delete. Each new zone automatically gets the NS and SOA
records that AWS creates for you.

**DNS records** — create, view, search by name or value, filter by type, sort,
edit and delete, within a zone. Nine record types are supported and each one is
validated properly:

| Type    | What it holds                | Example                          |
| ------- | ---------------------------- | -------------------------------- |
| `A`     | IPv4 address                 | `192.0.2.1`                      |
| `AAAA`  | IPv6 address                 | `2001:db8::1`                    |
| `CNAME` | An alias to another name     | `example.com`                    |
| `TXT`   | Free text                    | `"v=spf1 include:_spf ~all"`     |
| `MX`    | Mail server + priority       | `10 mail.example.com`            |
| `NS`    | Name server                  | `ns-1.awsdns-00.com`             |
| `PTR`   | Reverse lookup name          | `host.example.com`               |
| `SRV`   | Service location             | `1 10 5269 server.example.com`   |
| `CAA`   | Which CAs may issue certs    | `0 issue "amazon.com"`           |

**Route 53 behaviour that is reproduced on purpose:**

- A zone cannot be deleted while it still has records you created.
- The default NS and SOA records cannot be edited or deleted.
- A name can have only one record of each type.
- A name with a `CNAME` cannot have any other record, and vice versa.
- A record's name and type identify it, so editing changes only TTL and value.
- Typing `www` in a zone for `example.com` creates `www.example.com`; leaving
  the name blank creates a record for the domain itself.

**Placeholder sections** — Dashboard, Traffic policies, Health checks, Resolver
and Profiles each show a "Coming soon" page, as the assignment permits.

---

## Setup

You need **Python 3.10+** and **Node 18+**.

### Option A — Docker (one command)

```bash
docker compose up --build
```

Open <http://localhost:3000>.

### Option B — run the two parts yourself

**Terminal 1 — backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is now on <http://localhost:8000>, with interactive docs at
<http://localhost:8000/docs>.

On first start it creates `backend/route53.db` and fills it with five sample
zones so the app is not empty. Delete that file to start over.

**Terminal 2 — frontend:**

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with any email and any password of at
least four characters.

---

## Architecture

```
┌──────────────────────────┐        HTTP + JSON        ┌──────────────────────┐
│  Next.js (App Router)    │  ──────────────────────>  │  FastAPI             │
│  TypeScript, React 19    │  <──────────────────────  │  Python 3.10+        │
│                          │   Bearer token in the     │                      │
│  • pages under app/      │   Authorization header    │  • routers/          │
│  • lib/api.ts — the only │                           │  • dns_rules.py      │
│    place that calls the  │                           │  • SQLAlchemy models │
│    backend               │                           └──────────┬───────────┘
│  • lib/auth.tsx — who is │                                      │
│    signed in             │                                      ▼
│  • components/ — table,  │                           ┌──────────────────────┐
│    modal, toasts, etc.   │                           │  SQLite locally,     │
└──────────────────────────┘                           │  PostgreSQL deployed │
                                                       └──────────────────────┘
```

**How a request flows.** A page keeps its search, filter, sort and page number
in React state. When any of them change, it calls a function in `lib/api.ts`,
which adds the auth token and turns a failure into an `ApiError` carrying the
backend's message. The backend does the filtering, sorting and paging in SQL and
returns one page of results plus the totals the UI needs.

**Three deliberate choices:**

1. **The server does the searching and paging, not the browser.** Sending only
   one page of rows keeps the UI fast no matter how many records a zone has.
2. **All validation lives in `backend/app/dns_rules.py`.** The frontend shows
   hints, but it never decides what is valid — one source of truth, and adding a
   record type means editing one file.
3. **Error messages are written for people, not programs.** The backend returns
   `"'nope' is not a valid IPv4 address."`, and the UI shows that string
   directly under the field. No error-code translation table.

---

## Database schema

### Which database

One environment variable, `DATABASE_URL`, decides:

| `DATABASE_URL`                        | What runs                              |
| ------------------------------------- | -------------------------------------- |
| *unset*                               | SQLite at `backend/route53.db`          |
| `sqlite:////data/route53.db`          | SQLite at that path                     |
| `postgresql://user:pw@host/db`        | That Postgres server                    |

`backend/app/database.py` is the only file that knows the difference. It also
rewrites the legacy `postgres://` prefix that most hosts hand out, since
SQLAlchemy no longer accepts it, and turns on `pool_pre_ping` for Postgres so
the first request after an idle period reconnects instead of failing.

SQLite is the default because it makes local setup a `pip install` and nothing
else, and because the assignment specifies it. Postgres is used for the hosted
demo, where a local file would be wiped on every redeploy.

### The tables

Two of them. A zone owns its records, and deleting a zone deletes them with it.

### `hosted_zones`

| Column         | Type         | Notes                                       |
| -------------- | ------------ | ------------------------------------------- |
| `id`           | VARCHAR(32)  | Primary key. Looks like `Z1D633PJN98FT9`.   |
| `name`         | VARCHAR(255) | Domain name, e.g. `example.com`. Indexed.   |
| `comment`      | TEXT         | Free-text description.                      |
| `type`         | VARCHAR(16)  | `Public` or `Private`.                      |
| `name_servers` | TEXT         | Four servers, newline separated.            |
| `created_at`   | TIMESTAMPTZ  | Timezone-aware, so both databases agree.    |

Unique on `(name, type)` — you can have a public and a private zone for the
same domain, which is exactly what Route 53 allows.

### `dns_records`

| Column           | Type         | Notes                                          |
| ---------------- | ------------ | ---------------------------------------------- |
| `id`             | INTEGER      | Primary key, auto-increment (`SERIAL` on Postgres). |
| `zone_id`        | VARCHAR(32)  | Foreign key to `hosted_zones.id`, cascade delete. Indexed. |
| `name`           | VARCHAR(255) | Full record name, e.g. `www.example.com`. Indexed. |
| `type`           | VARCHAR(10)  | `A`, `AAAA`, `CNAME`, … Indexed.               |
| `ttl`            | INTEGER      | Seconds.                                       |
| `value`          | TEXT         | One or more values, newline separated.         |
| `routing_policy` | VARCHAR(32)  | `Simple` for now.                              |
| `is_system`      | BOOLEAN      | True for the NS and SOA records AWS creates. Those cannot be edited or deleted. |
| `created_at`     | TIMESTAMPTZ  |                                                |
| `updated_at`     | TIMESTAMPTZ  | Updated automatically on save.                 |

Unique on `(zone_id, name, type)` — the DNS rule that a name has at most one
record of each type, enforced by the database rather than by application code.

**Why values are newline separated rather than a third table.** A record with
two IP addresses is one record with two values, not two records — that is how
DNS defines it and how the AWS console displays it. Storing them as lines in one
column keeps reads to a single query and keeps the round-trip to the UI (a
textarea with one value per line) direct. The API always hands the frontend a
proper `values: string[]`, so this is an internal storage detail.

---

## API overview

Every route except `/api/health` and `/api/record-types` needs a header:

```
Authorization: Bearer <token>
```

### Auth

| Method | Path               | What it does                                  |
| ------ | ------------------ | --------------------------------------------- |
| POST   | `/api/auth/login`  | `{email, password}` → `{token, user}`         |
| POST   | `/api/auth/logout` | Invalidates the token. `204`                  |
| GET    | `/api/auth/me`     | The signed-in user. Used to restore a session |

### Hosted zones

| Method | Path               | What it does                                             |
| ------ | ------------------ | -------------------------------------------------------- |
| GET    | `/api/zones`       | List. Query: `search`, `type`, `sort`, `order`, `page`, `page_size` |
| POST   | `/api/zones`       | Create. `{name, comment, type}`                          |
| GET    | `/api/zones/{id}`  | One zone                                                 |
| PATCH  | `/api/zones/{id}`  | Update the description                                   |
| DELETE | `/api/zones/{id}`  | Delete. `409` if it still has your records               |

### DNS records

| Method | Path                                    | What it does                             |
| ------ | --------------------------------------- | ---------------------------------------- |
| GET    | `/api/zones/{id}/records`               | List. Same query options as zones        |
| POST   | `/api/zones/{id}/records`               | Create. `{name, type, ttl, value, routing_policy}` |
| GET    | `/api/zones/{id}/records/{recordId}`    | One record                               |
| PUT    | `/api/zones/{id}/records/{recordId}`    | Update TTL and value                     |
| DELETE | `/api/zones/{id}/records/{recordId}`    | Delete                                   |

### Import, export and bulk operations

| Method | Path                                    | What it does                                     |
| ------ | --------------------------------------- | ------------------------------------------------ |
| POST   | `/api/zones/{id}/import`                | Read a BIND zone file. `{content, overwrite}` → counts and warnings |
| GET    | `/api/zones/{id}/export?format=bind`    | Download the zone as a BIND file                 |
| GET    | `/api/zones/{id}/export?format=json`    | The same data as JSON                            |
| POST   | `/api/zones/{id}/records/bulk-delete`   | Delete many at once. `{ids: [...]}` → `{deleted, skipped}` |

### Meta

| Method | Path                 | What it does                                    |
| ------ | -------------------- | ----------------------------------------------- |
| GET    | `/api/health`        | `{"status": "ok"}`                              |
| GET    | `/api/record-types`  | The types the UI offers, with a hint for each   |

### Responses

A list endpoint returns one page plus the counts:

```json
{
  "items": [ ... ],
  "total": 42,
  "page": 2,
  "page_size": 10,
  "total_pages": 5
}
```

An error returns the message the UI should show:

```json
{ "detail": "'nope' is not a valid IPv4 address." }
```

Status codes used: `200` fine, `201` created, `204` deleted, `401` not signed
in, `404` not found, `409` conflicts with a DNS rule, `422` invalid input.

Full interactive docs are generated from the code at
<http://localhost:8000/docs>.

---

## Bonus features

All four optional items from the brief are implemented.

### Import and export BIND zone files

A BIND zone file is the plain-text format DNS has used for decades, and it is
what most registrars hand you when you export a domain. **Import** on a zone
page takes one by paste, file picker or drag-and-drop.

The parser in `backend/app/bind.py` handles the awkward parts of the format:

- `@` meaning the zone's own domain, and relative names like `www`
- an empty name column meaning "same owner as the line above"
- optional TTL and class columns, in either order
- records split across lines with `( )`, such as SOA
- `;` comments, including semicolons that appear inside quoted TXT values

Two things it does deliberately:

- **A bad line is a warning, not a failure.** Importing 40 of 42 records and
  reporting the other two beats rejecting the file. The summary shows counts
  for created, updated and skipped, plus a note for every line that needed
  attention.
- **Repeated names merge.** A zone file lists two IP addresses as two lines;
  in DNS that is one record with two values, so they are combined into a
  single record on the way in.

Existing records are left alone unless you tick "overwrite", and the default
NS and SOA records are never touched.

**Export** downloads the zone as a `.zone` file, or as JSON. Exporting a zone
and importing it into an empty one reproduces it exactly — there is a test for
that round trip.

### Bulk operations

Records have checkboxes and a select-all box in the header, which shows a
dash when only some rows on the page are selected. Selecting more than one
reveals a bar with **Delete selected**.

The confirmation lists every record and marks which ones will survive:
protected NS and SOA records are reported back rather than failing the whole
request, so "select all, delete" does the sensible thing instead of erroring.

### Dark mode

A toggle in the top bar, or press `d`.

Every colour in the app is a CSS variable declared in one `:root` block, so
dark mode is a second block that redefines those variables — no rule anywhere
else in the stylesheet needed a dark version.

If you have never chosen, it follows your operating system setting and keeps
following it until you pick one, at which point your choice is remembered.
A small script runs before the first paint so dark mode never flashes white
on load.

### Keyboard shortcuts

Press `?` for the list, or use the keyboard button in the top bar.

| Key   | Does                                              |
| ----- | ------------------------------------------------- |
| `/`   | Jump to the search box                            |
| `c`   | Create a hosted zone, or a record inside a zone   |
| `r`   | Refresh the list                                  |
| `i`   | Import a zone file (inside a zone)                |
| `e`   | Export the zone (inside a zone)                   |
| `d`   | Toggle dark mode                                  |
| `?`   | Show the shortcut list                            |
| `Esc` | Close a dialog                                    |

Shortcuts are ignored while you are typing in a field, so searching for
"create" does not fire the create shortcut five times, and any keystroke with
Cmd, Ctrl or Alt is left to the browser.

---

## Design notes

**Matching the AWS look.** The colours, spacing, rounded containers and pill
buttons come from AWS's Cloudscape design system, written by hand in
`frontend/app/globals.css` rather than pulled in as a dependency. All the
tokens sit in one `:root` block at the top of that file, so the whole theme can
be changed from one place.

**Components are generic, pages are specific.** `DataTable` knows about
columns, sorting and selection but nothing about DNS; the zones page and the
records page both use it and supply their own columns. Same for `Modal`,
`Pagination` and the notification system.

**Search does not fire on every keystroke.** `useDebounced` waits until you stop
typing, so a five-letter search sends one request instead of five.

**Deleting is hard to do by accident.** Deleting a record asks you to confirm and
shows what it points to. Deleting a whole zone additionally makes you type
`delete`.

### What is intentionally left out

- **Real DNS.** Nothing is served over port 53. The assignment asks for the
  Route 53 experience, not a name server.
- **Real authentication.** No password hashing, no JWTs, and sessions live in
  memory, so restarting the backend signs everyone out. `backend/app/auth.py`
  is deliberately the only file that would need to change.
- **Alias records and non-simple routing policies.** The column exists and every
  record reads `Simple`, so weighted and latency routing could be added without
  a schema migration.

---

## Project structure

```
route53-clone/
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app, CORS, startup
│   │   ├── database.py      Picks SQLite or Postgres from DATABASE_URL
│   │   ├── models.py        The two tables
│   │   ├── schemas.py       Request and response shapes
│   │   ├── auth.py          Mocked sign-in (swap this for real auth)
│   │   ├── dns_rules.py     Record types and their validation
│   │   ├── bind.py          BIND zone file parser and generator
│   │   ├── seed.py          Sample data on first run
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── zones.py
│   │       ├── records.py
│   │       └── transfer.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx               Providers
│   │   ├── globals.css              The whole design system
│   │   ├── login/page.tsx
│   │   └── (console)/
│   │       ├── layout.tsx           Top bar, sidebar, auth guard
│   │       ├── hosted-zones/page.tsx
│   │       ├── hosted-zones/[zoneId]/page.tsx
│   │       └── dashboard, traffic-policies, health-checks,
│   │           resolver, profiles   (Coming soon pages)
│   ├── components/                  Table, modal, pagination, nav, icons, UI bits
│   ├── lib/                         API client, auth, toasts, theme, shortcuts
│   └── Dockerfile
│
├── docker-compose.yml
└── render.yaml
```
