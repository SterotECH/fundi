from collections.abc import Mapping
from typing import Any

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.accounts.models import Organisation
from apps.projects.models import Project
from apps.projects.services import create_project
from apps.proposals.exceptions import (
    CannotConvertProposalError,
    CannotDeleteProposalError,
    CannotUpdateProposalAmountError,
    InvalidProposalClientError,
    InvalidProposalTransitionError,
)
from apps.proposals.models import Proposal

ALLOWED_STATUS_TRANSITIONS: dict[str, list[str]] = {
    Proposal.ProposalStatus.DRAFT: [
        Proposal.ProposalStatus.SENT,
    ],
    Proposal.ProposalStatus.SENT: [
        Proposal.ProposalStatus.NEGOTIATING,
        Proposal.ProposalStatus.WON,
        Proposal.ProposalStatus.LOST,
    ],
    Proposal.ProposalStatus.NEGOTIATING: [
        Proposal.ProposalStatus.WON,
        Proposal.ProposalStatus.LOST,
    ],
    Proposal.ProposalStatus.WON: [],
    Proposal.ProposalStatus.LOST: [],
}


def list_proposals(
    *, organisation: Organisation, filters: Mapping[str, Any]
) -> QuerySet[Proposal]:
    """
    List proposals for the given organisation, applying optional filters.
    Filters can include:
    - status: Filter by proposal status
    - search: Search in title, description, or client name
    This function allows for flexible querying of proposals while ensuring that
    only proposals belonging to the specified organisation are returned.

    """
    queryset = Proposal.objects.select_related("organisation", "client").filter(
        organisation=organisation
    )

    status_filter = filters.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    client_id_filter = filters.get("client_id")
    if client_id_filter:
        queryset = queryset.filter(client_id=client_id_filter)

    search_query = filters.get("search")
    if search_query:
        queryset = queryset.filter(
            Q(title__icontains=search_query)
            | Q(description__icontains=search_query)
            | Q(client__name__icontains=search_query)
        )

    ordering = filters.get("ordering")
    if ordering in {"deadline", "-deadline"}:
        return queryset.order_by(ordering, "-created_at")

    return queryset.order_by("title", "-created_at")


def create_proposal(*, organisation: Organisation, data: Mapping[str, Any]) -> Proposal:
    """
    Create a new proposal for the given organisation with the provided data.
    """
    client = data.get("client")
    if client and client.organisation_id != organisation.id:
        raise InvalidProposalClientError()
    return Proposal.objects.create(organisation=organisation, **data)


def update_proposal(*, proposal: Proposal, data: Mapping[str, Any]) -> Proposal:
    """
    Update an existing proposal with the provided data.
    """
    client = data.get("client")
    if client and client.organisation_id != proposal.organisation_id:
        raise InvalidProposalClientError()

    if (
        "amount" in data
        and data["amount"] != proposal.amount
        and proposal.status
        not in {
            Proposal.ProposalStatus.DRAFT,
            Proposal.ProposalStatus.SENT,
        }
    ):
        raise CannotUpdateProposalAmountError()

    for field, value in data.items():
        setattr(proposal, field, value)
    proposal.save()
    return proposal


def transition_proposal(*, proposal: Proposal, new_status: str) -> Proposal:
    """
    Move a proposal through the documented status state machine.
    """
    allowed_next_statuses = ALLOWED_STATUS_TRANSITIONS.get(proposal.status, [])
    if new_status not in allowed_next_statuses:
        raise InvalidProposalTransitionError(
            f"Cannot transition proposal from {proposal.status} to {new_status}."
        )

    today = timezone.localdate()
    proposal.status = new_status

    if new_status == Proposal.ProposalStatus.SENT:
        proposal.sent_date = today

    if new_status in {
        Proposal.ProposalStatus.WON,
        Proposal.ProposalStatus.LOST,
    }:
        proposal.decision_date = today

    proposal.save(
        update_fields=["status", "sent_date", "decision_date"]
    )
    return proposal


def get_proposal_detail(*, proposal_id: str, organisation: Organisation) -> Proposal:
    """
    Retrieve the details of a specific proposal by its ID, ensuring it belongs
    to the given organisation. This function is used to fetch all relevant
    information about a proposal for display or further processing.
    """
    return Proposal.objects.select_related("organisation", "client").get(
        id=proposal_id,
        organisation=organisation,
    )


def delete_proposal(*, proposal: Proposal) -> None:
    if proposal.status == Proposal.ProposalStatus.DRAFT:
        proposal.delete()
    else:
        raise CannotDeleteProposalError()


def convert_proposal_to_project(
    *, proposal: Proposal, data: Mapping[str, Any]
) -> Project:
    """
    Convert one won proposal into the minimal Sprint 1 project record.

    The conversion reuses the project service so the same budget/date and
    tenant relationship checks apply to manual project creation and conversion.
    """
    if proposal.status != Proposal.ProposalStatus.WON:
        raise CannotConvertProposalError()

    if Project.objects.filter(proposal=proposal).exists():
        raise CannotConvertProposalError("This proposal has already been converted.")

    title = str(data.get("title", "")).strip() or proposal.title
    return create_project(
        organisation=proposal.organisation,
        data={
            "client": proposal.client,
            "proposal": proposal,
            "title": title,
            "description": proposal.description,
            "start_date": data["start_date"],
            "due_date": data["due_date"],
            "budget": proposal.amount,
        },
    )
