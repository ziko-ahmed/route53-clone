# Route 53 Clone

A working clone of the AWS Route 53 console. You can sign in, create hosted
zones for your domains, and manage the DNS records inside them. Everything is
saved to a SQLite database, so it is still there when you come back.

It looks and behaves like the real AWS console, but it does not answer real DNS
queries — the point is the interface and the data model, not running DNS.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Setup](#setup)
3. [Architecture](#architecture)
4. [Database schema](#database-schema)
5. [API overview](#api-overview)
6. [Design notes](#design-notes)
7. [Deployment](#deployment)
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
│    modal, toasts, etc.   │                           │  SQLite (route53.db) │
└──────────────────────────┘                           └──────────────────────┘
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

Two tables. A zone owns its records, and deleting a zone deletes them with it.

### `hosted_zones`

| Column         | Type         | Notes                                       |
| -------------- | ------------ | ------------------------------------------- |
| `id`           | VARCHAR(32)  | Primary key. Looks like `Z1D633PJN98FT9`.   |
| `name`         | VARCHAR(255) | Domain name, e.g. `example.com`. Indexed.   |
| `comment`      | TEXT         | Free-text description.                      |
| `type`         | VARCHAR(16)  | `Public` or `Private`.                      |
| `name_servers` | TEXT         | Four servers, newline separated.            |
| `created_at`   | DATETIME     |                                             |

Unique on `(name, type)` — you can have a public and a private zone for the
same domain, which is exactly what Route 53 allows.

### `dns_records`

| Column           | Type         | Notes                                          |
| ---------------- | ------------ | ---------------------------------------------- |
| `id`             | INTEGER      | Primary key, auto-increment.                   |
| `zone_id`        | VARCHAR(32)  | Foreign key to `hosted_zones.id`, cascade delete. Indexed. |
| `name`           | VARCHAR(255) | Full record name, e.g. `www.example.com`. Indexed. |
| `type`           | VARCHAR(10)  | `A`, `AAAA`, `CNAME`, … Indexed.               |
| `ttl`            | INTEGER      | Seconds.                                       |
| `value`          | TEXT         | One or more values, newline separated.         |
| `routing_policy` | VARCHAR(32)  | `Simple` for now.                              |
| `is_system`      | BOOLEAN      | True for the NS and SOA records AWS creates. Those cannot be edited or deleted. |
| `created_at`     | DATETIME     |                                                |
| `updated_at`     | DATETIME     | Updated automatically on save.                 |

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
- **Bonus features.** BIND import/export, dark mode, keyboard shortcuts and bulk
  operations were listed as optional and are not built.

---

## Deployment

Frontend on Vercel, backend on Render. Both have a free tier.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Route 53 clone"
git remote add origin https://github.com/<you>/route53-clone.git
git push -u origin main
```

### 2. Backend on Render

1. Go to <https://render.com> → **New** → **Web Service** → connect the repo.
2. Render reads `render.yaml` and fills in the settings. If it does not:
   - Runtime: **Docker**
   - Dockerfile path: `./backend/Dockerfile`
   - Docker context: `./backend`
   - Health check path: `/api/health`
3. Add a **Disk** mounted at `/data`, 1 GB. Without it the database is wiped on
   every deploy.
4. Environment variables:
   - `DATABASE_URL` = `sqlite:////data/route53.db`
   - `ALLOWED_ORIGINS` = leave as a placeholder for now
5. Deploy, then copy the URL, e.g. `https://route53-clone-api.onrender.com`.
   Check `<that URL>/api/health` returns `{"status":"ok"}`.

Note: free Render services sleep when idle, so the first request after a quiet
spell takes 30–60 seconds.

### 3. Frontend on Vercel

1. Go to <https://vercel.com> → **Add New** → **Project** → import the repo.
2. Set **Root Directory** to `frontend`. Vercel detects Next.js by itself.
3. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render URL from step 2
4. Deploy, then copy the URL, e.g. `https://route53-clone.vercel.app`.

### 4. Connect the two

Go back to Render, set `ALLOWED_ORIGINS` to your Vercel URL, and save. The
service restarts. Without this the browser blocks every API call with a CORS
error.

Open the Vercel URL and sign in.

> `NEXT_PUBLIC_API_URL` is read at build time, not at run time. If you change it
> later, redeploy the frontend.

---

## Project structure

```
route53-clone/
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app, CORS, startup
│   │   ├── database.py      SQLite connection and session
│   │   ├── models.py        The two tables
│   │   ├── schemas.py       Request and response shapes
│   │   ├── auth.py          Mocked sign-in (swap this for real auth)
│   │   ├── dns_rules.py     Record types and their validation
│   │   ├── seed.py          Sample data on first run
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── zones.py
│   │       └── records.py
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
│   ├── components/                  Table, modal, pagination, nav, UI bits
│   ├── lib/                         API client, auth, toasts, helpers
│   └── Dockerfile
│
├── docker-compose.yml
└── render.yaml
```
