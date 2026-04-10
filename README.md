# Fundi

> A company operating system built for African freelancers and small teams.
> Starting with Stero Tech Inc. — a solo software business serving Ghanaian schools.

Fundi is a CRM and business OS that grows with you. It starts as a solo client and proposal tracker, and expands into a full company operating system covering finance, operations, people management, and AI-powered business intelligence — all in a single product built for the African context: Ghana Cedi, MTN MoMo, GRA VAT, and a mobile-first market.

---

## What Fundi does

| Module                          | What it covers                                                                      |
|---------------------------------|-------------------------------------------------------------------------------------|
| **Pipeline**                    | Lead tracking, proposal management with state machine, win/loss analytics           |
| **Clients**                     | Full relationship view — proposals, projects, invoices, payments, time in one place |
| **Projects**                    | Delivery tracking with milestones, time logging, and budget vs actuals              |
| **Finance**                     | Invoices, payment recording (MoMo / bank transfer), overdue tracking                |
| **AI Assistant**                | Claude-powered business assistant that reads your live CRM data                     |
| **Analytics**                   | Revenue trends, win rate, client profitability, time-to-close                       |
| **Operations** *(Sprint 4+)*    | Contracts, expenses, tasks, staff management                                        |
| **Client Portal** *(Sprint 7+)* | Read-only access for school contacts to view invoices and project status            |

---

## Tech stack

| Layer         | Technology                                                     |
|---------------|----------------------------------------------------------------|
| Backend       | Django 6 + Django REST Framework                               |
| Auth          | SimpleJWT (access token in memory, refresh in HttpOnly cookie) |
| Database      | PostgreSQL                                                     |
| Cache / Queue | Redis + Celery + Celery Beat                                   |
| API Docs      | drf-spectacular (OpenAPI 3)                                    |
| Frontend      | React (Vite) + Tailwind CSS v4 + React Query + React Router    |
| AI            | Anthropic API — claude-sonnet                                  |
| Containers    | Docker Compose                                                 |
| Reverse Proxy | Caddy                                                          |
| Testing       | pytest-django + factory_boy (backend) · Vitest (frontend)      |

---

## Architecture decisions

These decisions are locked in from day one. Do not change them without a documented reason.

- **UUIDs as PKs** — never integer IDs. Prevents leaking record counts to anyone inspecting API responses.
- **Custom User model** — email-based, set before the first migration. Cannot be changed after.
- **Organisation model on every entity** — one extra FK that makes the entire system multi-tenant when ready.
- **JWT security** — access token in React state (not localStorage), refresh token in HttpOnly cookie.
- **Decimal for money** — `DecimalField(max_digits=12, decimal_places=2)` everywhere. Never `float`.
- **Soft delete** — `is_archived` flag on clients and key entities. Financial history is never destroyed.
- **Invoice numbering** — Postgres sequence, not `MAX + 1`. Atomic and race-condition-safe.
- **Proposal state machine** — enforced in a service function, not the view layer.
- **AuditLog** — every model change is recorded with user + before/after diff from Sprint 1.

---

## Sprint plan

| Sprint | Theme                                                                | Weeks  |
|--------|----------------------------------------------------------------------|--------|
| 1      | The Usable Core — auth, clients, leads, proposals, dashboard         | 1–3    |
| 2      | The Money Layer — invoices, payments, time logging, Celery reminders | 4–6    |
| 3      | The Intelligence Layer — AI assistant, analytics, mobile polish      | 7–9    |
| 4+     | Operations, Finance, People, Client Portal, Proactive AI             | Future |

---

## Local development setup

### Prerequisites

- Docker + Docker Compose
- Poetry (`pip install poetry`)
- Node.js 20+

### 1. Clone the repository

```bash
git clone https://github.com/sterotech/fundi.git
cd fundi
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start all services

```bash
docker compose up --build
```

| Service  | URL                                            |
|----------|------------------------------------------------|
| API      | <http://localhost:8000/api/v1/>                |
| API Docs | <http://localhost:8000/api/schema/swagger-ui/> |
| Frontend | <http://localhost:3000>                        |

### 4. Run database migrations

```bash
docker compose exec backend python manage.py migrate
```

### 5. Create your organisation and superuser

```bash
docker compose exec backend python manage.py shell
```

```python
from apps.accounts.models import Organisation, User
org = Organisation.objects.create(name="Stero Tech Inc.", slug="stero-tech", currency="GHS", country="GH")
User.objects.create_superuser(email="you@stereotech.com", password="yourpassword", organisation=org)
```

---

## Running tests

```bash
# Backend
docker compose exec backend pytest

# With coverage
docker compose exec backend pytest --cov=apps --cov-report=term-missing
```

---

## Project structure

fundi/
├── backend/
│   ├── apps/
│   │   ├── accounts/       # User, Organisation models + auth endpoints
│   │   ├── clients/        # Client + Lead models + endpoints
│   │   ├── proposals/      # Proposal state machine + endpoints
│   │   ├── projects/       # Project + Milestone models
│   │   ├── finance/        # Invoice, Payment, TimeLog (Sprint 2)
│   │   ├── notifications/  # Notification model + Celery tasks
│   │   └── core/           # AuditLog, base models, shared utilities
│   ├── config/             # settings/, urls.py, wsgi.py, asgi.py
│   ├── manage.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   └── package.json
├── docker-compose.yml
├── .env
└── README.md

---

## Currency and locale

All monetary values are stored and displayed in **Ghana Cedi (GHS)**. Payment methods supported: MTN MoMo, Vodafone Cash, AirtelTigo Money, bank transfer, cash.

---

## License

Private — Stero Tech Inc. All rights reserved.
