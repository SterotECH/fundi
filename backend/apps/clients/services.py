"""
Service-layer functions for the clients app.

Some functions in this module are implemented and used as reference examples
for the agreed service-layer architecture. Others remain intentionally
unimplemented until the related models and endpoints exist.

Think of this file the same way you would think of a Laravel service class:
views/controllers should stay thin, while queryset rules, organisation scoping,
soft-archive rules, and cross-model orchestration live here.
"""

from typing import Any, Mapping

from django.db.models import Q, QuerySet

from apps.accounts.models import Organisation
from apps.clients.models import Client


def _coerce_bool_filter(value: Any) -> bool | None:
    """
    Convert common query-param boolean shapes into a real Python boolean.

    DRF query params usually arrive as strings, so `"true"` and `"false"`
    should not be compared directly to `True` or `False`.
    """
    if value is None:
        return None

    if isinstance(value, bool):
        return value

    normalized_value = str(value).strip().lower()

    if normalized_value in {"true", "1", "yes"}:
        return True

    if normalized_value in {"false", "0", "no"}:
        return False

    return None


def list_clients(
    *,
    organisation: Organisation,
    filters: Mapping[str, Any],
) -> QuerySet[Client]:
    """
    Return an organisation-scoped client queryset for list endpoints.

    What this implementation does:
    - organisation scoping happens first so no later filter can leak data
    - defaults to active clients unless `is_archived` is explicitly requested
    - supports text search across name, email, and contact person
    - supports filtering by client type
    - ordering is explicit so API responses stay predictable

    The view can pass `request.query_params` directly as `filters` because this
    service normalizes the boolean archive filter internally.
    """
    queryset = Client.objects.filter(organisation=organisation).order_by(
        "name",
        "-created_at",
    )

    # Default to active clients unless the caller explicitly asks otherwise.
    archived_filter = _coerce_bool_filter(filters.get("is_archived"))
    if archived_filter is None:
        queryset = queryset.filter(is_archived=False)
    else:
        queryset = queryset.filter(is_archived=archived_filter)

    search_term = str(filters.get("search", "")).strip()
    if search_term:
        queryset = queryset.filter(
            Q(name__icontains=search_term)
            | Q(email__icontains=search_term)
            | Q(contact_person__icontains=search_term)
        )

    client_type = filters.get("type")
    if client_type:
        queryset = queryset.filter(type=client_type)

    return queryset


def create_client(*, organisation: Organisation, data: Mapping[str, Any]) -> Client:
    """
    Create one client inside the authenticated user's organisation.

    Why this method is now written this way:
    - the view owns HTTP + serializer validation concerns
    - the service owns domain creation concerns
    - `organisation` is injected on the server side so the client cannot choose
      a tenant in the request payload

    Target shape for the call site:
    - the view validates request data first
    - this service receives `serializer.validated_data`, not raw request data
      and not a DRF `Request` object
    - attach the current organisation on the server side
    - enforce any business rules that do not belong in serializer validation
    - create the record and return the new `Client` instance
    - emit audit logging if Sprint 1 audit hooks are not fully signal-driven yet
    """
    return Client.objects.create(organisation=organisation, **data)


def get_client_detail(*, organisation: Organisation, client_id: str) -> Client:
    """
    Return one client detail record scoped to the caller's organisation.

    What this implementation does:
    - fetches a single client by `id` and `organisation`
    - relies on `.get(...)` so Django raises `Client.DoesNotExist` naturally
      when the record is missing

    Why this is okay with the global exception handler:
    - the service does not import DRF or raise HTTP-specific exceptions
    - `backend/utils/exceptions.py` converts `ObjectDoesNotExist` into a 404
    - the view stays thin and does not repeat try/except blocks per endpoint
    """
    return Client.objects.get(id=client_id, organisation=organisation)


def update_client(*, client: Client, data: Mapping[str, Any]) -> Client:
    """
    Mutate and save an already-fetched client instance.

    The view is responsible for fetching the organisation-scoped client and
    turning missing records into HTTP 404 responses. This service should not hit
    the database again for the same row; its job starts after the valid client
    instance already exists.
    """
    for field, value in data.items():
        setattr(client, field, value)
    client.save()
    return client


def archive_client(*, client: Client) -> Client:
    """
    Soft-archive an already-fetched client instance.

    This is the delete path for clients. We keep the row for history and future
    reporting, then hide it from normal list results through `list_clients()`.
    """
    client.is_archived = True
    client.save()
    return client


def list_client_proposals(*, organisation: Organisation, client_id: str) -> Any:
    """
    Return all proposals that belong to one client in one organisation.

    What this method should do when you implement it:
    - verify the client belongs to the current organisation
    - query proposals through the client relationship
    - add explicit ordering and related loading for predictable API responses
    - return the queryset for serialization
    """
    raise NotImplementedError("Stub only. Implement client proposal listing here.")


def list_client_invoices(*, organisation: Organisation, client_id: str) -> Any:
    """
    Return all invoices that belong to one client in one organisation.

    What this method should do when you implement it:
    - verify organisation ownership before exposing financial data
    - query invoices for the client with explicit ordering
    - later, consider annotations for totals/outstanding balances if needed
    - return the queryset for serialization
    """
    raise NotImplementedError("Stub only. Implement client invoice listing here.")


def list_client_projects(*, organisation: Organisation, client_id: str) -> Any:
    """
    Return all projects that belong to one client in one organisation.

    What this method should do when you implement it:
    - verify the client is organisation-scoped
    - query linked projects with explicit related loading
    - keep this small in Sprint 1 because project detail stays intentionally thin
    - return the queryset for serialization
    """
    raise NotImplementedError("Stub only. Implement client project listing here.")
