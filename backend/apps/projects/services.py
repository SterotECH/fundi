from collections.abc import Mapping
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.db import transaction
from django.db.models import QuerySet, Sum
from django.utils import timezone

from apps.accounts.models import Organisation, User
from apps.invoices.models import Invoice
from apps.projects.exceptions import (
    InvalidProjectBudgetError,
    InvalidProjectClientError,
    InvalidProjectDateRangeError,
    InvalidProjectProposalError,
)
from apps.projects.models import Milestone, Project, TimeLog

_MISSING = object()
ZERO_DECIMAL = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")


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

    milestone_rows = list(data.get("milestones", []))
    project_data = {key: value for key, value in data.items() if key != "milestones"}

    with transaction.atomic():
        project = Project.objects.create(organisation=organisation, **project_data)

        if milestone_rows:
            Milestone.objects.bulk_create(
                [
                    Milestone(
                        project=project,
                        title=milestone["title"],
                        description=milestone.get("description", ""),
                        due_date=milestone["due_date"],
                        is_completed=milestone.get("completed", False),
                        completed_at=timezone.now()
                        if milestone.get("completed", False)
                        else None,
                        order=milestone["order"],
                    )
                    for milestone in milestone_rows
                ]
            )

    return project


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


def list_project_milestones(
    *, organisation: Organisation, project_id: str
) -> QuerySet[Milestone]:
    """
    Return milestones for one organisation-scoped project.
    """
    get_project_detail(organisation=organisation, project_id=project_id)
    return Milestone.objects.select_related("project").filter(
        project__organisation=organisation,
        project_id=project_id,
    ).order_by("order", "due_date", "-created_at")


def get_project_milestone(
    *, organisation: Organisation, project_id: str, milestone_id: str
) -> Milestone:
    """
    Return one milestone scoped by organisation and project.
    """
    return Milestone.objects.select_related("project").get(
        id=milestone_id,
        project_id=project_id,
        project__organisation=organisation,
    )


def create_project_milestone(*, project: Project, data: Mapping[str, Any]) -> Milestone:
    """
    Create a milestone for an already organisation-scoped project.
    """
    return Milestone.objects.create(project=project, **data)


def update_project_milestone(
    *, milestone: Milestone, data: Mapping[str, Any]
) -> Milestone:
    """
    Update a milestone and keep `completed_at` in sync with completion state.
    """
    completed_flag = data.get("is_completed", milestone.is_completed)
    for field, value in data.items():
        setattr(milestone, field, value)

    if completed_flag and not milestone.completed_at:
        milestone.completed_at = timezone.now()
    elif not completed_flag:
        milestone.completed_at = None

    milestone.save()
    return milestone


def delete_project_milestone(*, milestone: Milestone) -> None:
    """
    Delete one milestone row.
    """
    milestone.delete()


def list_time_logs(
    *, organisation: Organisation, filters: Mapping[str, Any]
) -> QuerySet[TimeLog]:
    """
    Return organisation-scoped time logs with documented filters.
    """
    queryset = TimeLog.objects.select_related("project", "user").filter(
        project__organisation=organisation
    )

    project_id_filter = filters.get("project_id")
    if project_id_filter:
        queryset = queryset.filter(project_id=project_id_filter)

    date_from = filters.get("log_date__gte")
    if date_from:
        queryset = queryset.filter(log_date__gte=date_from)

    date_to = filters.get("log_date__lte")
    if date_to:
        queryset = queryset.filter(log_date__lte=date_to)

    billable = filters.get("billable")
    if billable is not None:
        normalized = str(billable).strip().lower()
        if normalized in {"true", "1", "yes"}:
            queryset = queryset.filter(is_billable=True)
        elif normalized in {"false", "0", "no"}:
            queryset = queryset.filter(is_billable=False)

    return queryset.order_by("-log_date", "-created_at")


def get_time_log_detail(*, organisation: Organisation, time_log_id: str) -> TimeLog:
    """
    Return one time log scoped to the authenticated organisation.
    """
    return TimeLog.objects.select_related("project", "user").get(
        id=time_log_id,
        project__organisation=organisation,
    )


def create_time_log(
    *,
    organisation: Organisation,
    user: User,
    data: Mapping[str, Any],
) -> TimeLog:
    """
    Create a time log for an organisation-scoped project.
    """
    project = data["project"]
    if project.organisation_id != organisation.id:
        raise Project.DoesNotExist()

    return TimeLog.objects.create(
        project=project,
        user=user,
        log_date=data["log_date"],
        hours=data["hours"],
        description=data.get("description", ""),
        is_billable=data.get("is_billable", True),
    )


def update_time_log(*, time_log: TimeLog, data: Mapping[str, Any]) -> TimeLog:
    """
    Update an already organisation-scoped time log.
    """
    project = data.get("project")
    if (
        project is not None
        and project.organisation_id != time_log.project.organisation_id
    ):
        raise Project.DoesNotExist()

    for field, value in data.items():
        setattr(time_log, field, value)

    time_log.save()
    return time_log


def delete_time_log(*, time_log: TimeLog) -> None:
    """
    Delete one time log row.
    """
    time_log.delete()


def list_project_time_logs(
    *, organisation: Organisation, project_id: str
) -> dict[str, Any]:
    """
    Return time logs plus aggregate metrics for one organisation-scoped project.
    """
    project = get_project_detail(organisation=organisation, project_id=project_id)
    queryset = TimeLog.objects.select_related("project", "user").filter(
        project=project
    ).order_by("-log_date", "-created_at")

    total_hours = queryset.aggregate(total=Sum("hours"))["total"] or ZERO_DECIMAL
    billable_hours = (
        queryset.filter(is_billable=True).aggregate(total=Sum("hours"))["total"]
        or ZERO_DECIMAL
    )
    non_billable_hours = total_hours - billable_hours
    effective_rate = ZERO_DECIMAL
    if billable_hours > ZERO_DECIMAL:
        effective_rate = (project.budget / billable_hours).quantize(
            MONEY_QUANT,
            rounding=ROUND_HALF_UP,
        )

    return {
        "queryset": queryset,
        "total_hours": total_hours,
        "billable_hours": billable_hours,
        "non_billable_hours": non_billable_hours,
        "effective_rate": effective_rate,
    }


def list_project_invoices(
    *, organisation: Organisation, project_id: str
) -> QuerySet[Invoice]:
    """
    Return invoices linked to one organisation-scoped project.
    """
    project = get_project_detail(organisation=organisation, project_id=project_id)
    return (
        Invoice.objects.select_related("organisation", "client", "project")
        .filter(organisation=organisation, project=project)
        .order_by("-issue_date", "-created_at")
    )
