from collections.abc import Mapping
from typing import Any

from django.db import transaction
from django.db.models import Q, QuerySet

from apps.accounts.models import Organisation
from apps.clients.exceptions import LeadAlreadyConvertedError
from apps.clients.models import Client, Lead
from apps.projects.models import Project
from apps.proposals.models import Proposal


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


def list_client_proposals(
    *, organisation: Organisation, client_id: str
) -> QuerySet[Proposal]:
    """
    Return all proposals that belong to one client in one organisation.

    The initial client lookup is intentional: it makes a cross-organisation
    client id indistinguishable from a missing client id and lets the global
    exception handler return the standard 404 response.
    """
    get_client_detail(organisation=organisation, client_id=client_id)
    return (
        Proposal.objects.select_related("organisation", "client")
        .filter(organisation=organisation, client_id=client_id)
        .order_by("deadline", "-created_at")
    )


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


def list_client_projects(
    *, organisation: Organisation, client_id: str
) -> QuerySet[Project]:
    """
    Return all projects that belong to one client in one organisation.

    Keep this intentionally thin for Sprint 1: the full project-management
    surface, milestones, and time logs are later work.
    """
    get_client_detail(organisation=organisation, client_id=client_id)
    return (
        Project.objects.select_related("organisation", "client", "proposal")
        .filter(organisation=organisation, client_id=client_id)
        .order_by("due_date", "-created_at")
    )


def list_leads(
    *, organisation: Organisation, filters: Mapping[str, Any]
) -> QuerySet[Lead]:
    """
    Return an organisation-scoped lead queryset for list endpoints.

    What this implementation does:
    - organisation scoping happens first so no later filter can leak data
    - supports text search across name, email, phone, and contact person
    - supports filtering by lead source and status
    - ordering is explicit so API responses stay predictable
    """
    queryset = Lead.objects.filter(organisation=organisation).order_by(
        "name",
        "-created_at",
    )

    status_filter = filters.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    else:
        queryset = queryset.filter(
            status__in=[
                Lead.LeadStatus.NEW,
                Lead.LeadStatus.CONTACTED,
                Lead.LeadStatus.QUALIFIED,
            ]
        )

    search_term = str(filters.get("search", "")).strip()
    if search_term:
        queryset = queryset.filter(
            Q(name__icontains=search_term)
            | Q(email__icontains=search_term)
            | Q(phone__icontains=search_term)
            | Q(contact_person__icontains=search_term)
        )
    source_filter = filters.get("source")
    if source_filter:
        queryset = queryset.filter(source=source_filter)

    return queryset


def create_lead(*, organisation: Organisation, data: Mapping[str, Any]) -> Lead:
    """
    Create one lead inside the authenticated user's organisation.

    Why this method is now written this way:
    - the view owns HTTP + serializer validation concerns
    - the service owns domain creation concerns
    - `organisation` is injected on the server side so the client cannot choose
      a tenant in the request payload
    - leads have different fields and rules than clients, so we keep them separate
      for now; if you later decide to implement lead-specific endpoints, you can
      add more lead-focused fields and validation logic here without affecting
      client creation logic
    """
    return Lead.objects.create(organisation=organisation, **data)


def get_lead_detail(*, organisation: Organisation, lead_id: str) -> Lead:
    """
    Return one lead detail record scoped to the caller's organisation.

    What this implementation does:
    - fetches a single lead by `id` and `organisation`
    - relies on `.get(...)` so Django raises `Lead.DoesNotExist` naturally when
      the record is missing

    Why this is okay with the global exception handler:
    - the service does not import DRF or raise HTTP-specific exceptions
    - `backend/utils/exceptions.py` converts `ObjectDoesNotExist` into a 404
    - the view stays thin and does not repeat try/except blocks per endpoint
    """
    return Lead.objects.get(id=lead_id, organisation=organisation)


def update_lead(*, lead: Lead, data: Mapping[str, Any]) -> Lead:
    """
    Mutate and save an already-fetched lead instance.

    The view is responsible for fetching the organisation-scoped lead and
    turning missing records into HTTP 404 responses. This service should not hit
    the database again for the same row; its job starts after the valid lead
    instance already exists.
    """
    for field, value in data.items():
        setattr(lead, field, value)
    lead.save()
    return lead


def mark_lead_dead(*, lead: Lead) -> Lead:
    """
    Soft-archive a lead instance.

    This is the delete path for leads. We keep the row for history and future
    reporting, then hide it from normal list results through `list_leads()`.
    """
    lead.status = Lead.LeadStatus.DEAD
    lead.save()
    return lead


def convert_lead_to_client(*, lead: Lead, data: Mapping[str, Any]) -> Client:
    """
    Convert one already-fetched lead into a client.

    Why this method is explicit instead of passing `data` straight into
    `create_client()`:
    - conversion request data may contain action-only fields that are not
      `Client` model fields
    - lead values should be the fallback, while validated request data can
      override contact fields when the user corrects them during conversion
    - client creation and lead status update must happen atomically so we do
      not create a client without linking the lead, or link a lead without a
      client
    """
    if lead.converted_to_client:
        raise LeadAlreadyConvertedError

    client_data = {
        "type": data["type"],
        "name": lead.name,
        "email": data.get("email", lead.email),
        "contact_person": data.get("contact_person", lead.contact_person),
        "phone": data.get("phone", lead.phone),
        "address": data.get("address", ""),
        "region": data.get("region", "Ghana"),
        "notes": (
            f"Converted from lead {lead.id} "
            f"(source: {lead.source}, previous status: {lead.status})."
        ),
    }

    extra_notes = str(data.get("notes", "")).strip()
    if extra_notes:
        client_data["notes"] = f"{client_data['notes']} {extra_notes}"

    with transaction.atomic():
        lead_client = create_client(
            organisation=lead.organisation,
            data=client_data,
        )
        lead.status = Lead.LeadStatus.CONVERTED
        lead.converted_to_client = lead_client
        lead.save(update_fields=["status", "converted_to_client", "updated_at"])

    return lead_client
