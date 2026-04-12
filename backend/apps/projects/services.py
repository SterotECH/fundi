from collections.abc import Mapping
from typing import Any

from django.db.models import QuerySet

from apps.accounts.models import Organisation
from apps.projects.exceptions import (
    InvalidProjectBudgetError,
    InvalidProjectClientError,
    InvalidProjectDateRangeError,
    InvalidProjectProposalError,
)
from apps.projects.models import Project

_MISSING = object()


def list_projects(
    *, organisation: Organisation, filters: Mapping[str, Any]
) -> QuerySet[Project]:
    """
    Return an organisation-scoped queryset for the project list endpoint.

    The list supports the documented `status` and `client_id` filters and
    eagerly loads direct relationships needed by serializers.
    """
    queryset = Project.objects.select_related(
        "organisation",
        "client",
        "proposal",
    ).filter(organisation=organisation)

    status_filter = filters.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    client_id_filter = filters.get("client_id")
    if client_id_filter:
        queryset = queryset.filter(client_id=client_id_filter)

    return queryset.order_by("due_date", "-created_at")


def _validate_project_relationships(
    *,
    organisation: Organisation,
    data: Mapping[str, Any],
    existing_project: Project | None = None,
) -> None:
    """
    Enforce tenant-safe project relationships.

    A project cannot point at a client or proposal from another organisation.
    If a proposal is supplied, it must also belong to the selected project
    client so conversion/manual linking cannot create inconsistent history.
    """
    client = data.get("client") or getattr(existing_project, "client", None)
    proposal = data.get("proposal", _MISSING)
    if proposal is _MISSING:
        proposal = getattr(existing_project, "proposal", None)

    if client and client.organisation_id != organisation.id:
        raise InvalidProjectClientError()

    if proposal is None:
        return

    if proposal.organisation_id != organisation.id:
        raise InvalidProjectProposalError()

    if client and proposal.client_id != client.id:
        raise InvalidProjectProposalError()


def _validate_project_values(
    *, data: Mapping[str, Any], existing_project: Project | None = None
) -> None:
    """
    Enforce scalar project rules shared by create and update.

    Budget must be positive when supplied, and a project cannot end before it
    starts. For partial updates, missing values fall back to the existing row.
    """
    budget = data.get("budget")
    if budget is not None and budget <= 0:
        raise InvalidProjectBudgetError()

    start_date = data.get("start_date") or getattr(existing_project, "start_date", None)
    due_date = data.get("due_date") or getattr(existing_project, "due_date", None)
    if start_date and due_date and due_date < start_date:
        raise InvalidProjectDateRangeError()


def create_project(*, organisation: Organisation, data: Mapping[str, Any]) -> Project:
    """
    Create a project under the authenticated user's organisation.

    The caller passes serializer-validated data; this service attaches the
    server-side organisation and protects cross-tenant client/proposal links.
    """
    _validate_project_relationships(organisation=organisation, data=data)
    _validate_project_values(data=data)

    return Project.objects.create(organisation=organisation, **data)


def get_project_detail(*, organisation: Organisation, project_id: str) -> Project:
    """
    Return one project scoped to the authenticated user's organisation.

    Missing projects, including projects from other organisations, naturally
    raise `Project.DoesNotExist` for the global exception handler to convert
    into a 404 response.
    """
    return Project.objects.select_related("organisation", "client", "proposal").get(
        id=project_id,
        organisation=organisation,
    )


def update_project(*, project: Project, data: Mapping[str, Any]) -> Project:
    """
    Update an already-fetched organisation-scoped project instance.

    Keeping the fetch in the view avoids duplicate queries. This service handles
    only domain validation and mutation.
    """
    _validate_project_relationships(
        organisation=project.organisation,
        data=data,
        existing_project=project,
    )
    _validate_project_values(data=data, existing_project=project)

    for field, value in data.items():
        setattr(project, field, value)

    project.save()
    return project
