# Repository Guidelines

## Project Structure & Module Organization

`backend/` is the active codebase. Domain apps live in `backend/apps/` (`accounts`, `clients`, `proposals`, `projects`, `core`), while Django settings, URLs, ASGI, and WSGI live in `backend/config/`. Dependency management is handled through `backend/pyproject.toml` and `backend/poetry.lock`. Container orchestration lives in `compose.yaml`; the published Postgres host port is `5434`. `frontend/` exists but is not scaffolded yet.

## Build, Test, and Development Commands

- `docker compose up --build`: build and start the full stack.
- `docker compose up -d`: run services in the background.
- `docker compose exec backend python manage.py migrate`: apply migrations.
- `docker compose exec backend pytest`: run backend tests.
- `docker compose exec backend pytest --cov=apps --cov-report=term-missing`: run coverage for Django apps.
- `cd backend && poetry install`: install local backend dependencies.

## Engineering Rules

This project is built with strict architectural constraints. Do not deviate from them: UUID primary keys everywhere, custom email-based user model before first migration, organisation FK on tenant data, `DecimalField(max_digits=12, decimal_places=2)` for money, soft delete via `is_archived`, invoice numbers from a Postgres sequence, proposal transitions in `services.py`, and audit logging from Sprint 1.

Use Django the way we agreed: ViewSets + Routers by default, `@action` for non-CRUD endpoints, serializers in `serializers.py`, business logic in `services.py`, and `APIException` subclasses for API errors. Every queryset must be organisation-scoped and should use `select_related`/`prefetch_related` explicitly.

## Coding Style & Teaching Context

Use 4-space indentation and standard Python naming: `snake_case` for functions, `PascalCase` for classes. Match the existing app layout. When explaining Django concepts, prefer Laravel/Livewire analogies because this repo is also a teaching surface for Stero. Be direct, explain the why, and push back on weak architectural decisions.

## Testing Guidelines

Backend tests use `pytest` and `pytest-django` with `DJANGO_SETTINGS_MODULE=config.settings.test`. Valid test file names are `tests.py`, `test_*.py`, and `*_test.py`. Minimum standard: every endpoint gets at least one pytest-django test. Add coverage for service logic and organisation scoping, not just happy-path responses.

## Commit & Pull Request Guidelines

Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`. Example: `feat(clients): add archive action`. Keep commits focused and reversible.

PRs should state the user-facing change, list schema or env updates, include verification commands, and call out anything that violates Sprint 1 scope freeze. Do not sneak Sprint 2 or 3 work into Sprint 1.
