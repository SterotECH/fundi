from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.projects.models import Project
from apps.proposals import services
from apps.proposals.exceptions import (
    CannotConvertProposalError,
    CannotDeleteProposalError,
    CannotUpdateProposalAmountError,
    InvalidProposalClientError,
    InvalidProposalTransitionError,
)
from apps.proposals.factories import ProposalFactory
from apps.proposals.models import Proposal


@pytest.mark.django_db
def test_list_proposals_returns_only_requested_organisation(org):
    own_proposal = ProposalFactory(organisation=org, title="Own Proposal")
    ProposalFactory(organisation=OrganisationFactory(), title="Other Proposal")

    queryset = services.list_proposals(organisation=org, filters={})

    assert list(queryset) == [own_proposal]


@pytest.mark.django_db
def test_list_proposals_filters_by_status_and_client_id(org):
    client = ClientFactory(organisation=org)
    matching_proposal = ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
    )
    ProposalFactory(organisation=org, status=Proposal.ProposalStatus.DRAFT)
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.SENT,
    )

    queryset = services.list_proposals(
        organisation=org,
        filters={
            "status": Proposal.ProposalStatus.SENT,
            "client_id": str(client.id),
        },
    )

    assert list(queryset) == [matching_proposal]


@pytest.mark.django_db
def test_list_proposals_orders_by_deadline(org):
    later = ProposalFactory(
        organisation=org,
        title="Later",
        deadline=timezone.localdate() + timedelta(days=10),
    )
    earlier = ProposalFactory(
        organisation=org,
        title="Earlier",
        deadline=timezone.localdate() + timedelta(days=1),
    )

    queryset = services.list_proposals(
        organisation=org,
        filters={"ordering": "deadline"},
    )

    assert list(queryset) == [earlier, later]


@pytest.mark.django_db
def test_create_proposal_attaches_organisation_and_rejects_wrong_client(org):
    client = ClientFactory(organisation=org)

    proposal = services.create_proposal(
        organisation=org,
        data={
            "client": client,
            "title": "New Proposal",
            "description": "A proposal created through the service.",
            "amount": Decimal("1500.00"),
            "deadline": timezone.localdate() + timedelta(days=14),
            "notes": "",
        },
    )

    assert proposal.organisation == org
    assert proposal.client == client
    assert proposal.status == Proposal.ProposalStatus.DRAFT

    other_client = ClientFactory(organisation=OrganisationFactory())
    with pytest.raises(InvalidProposalClientError):
        services.create_proposal(
            organisation=org,
            data={
                "client": other_client,
                "title": "Bad Proposal",
                "description": "Wrong tenant client.",
                "amount": Decimal("1500.00"),
                "deadline": timezone.localdate() + timedelta(days=14),
                "notes": "",
            },
        )


@pytest.mark.django_db
def test_update_proposal_rejects_wrong_client_and_locked_amount(org):
    proposal = ProposalFactory(
        organisation=org,
        amount=Decimal("1000.00"),
        status=Proposal.ProposalStatus.NEGOTIATING,
    )
    other_client = ClientFactory(organisation=OrganisationFactory())

    with pytest.raises(InvalidProposalClientError):
        services.update_proposal(proposal=proposal, data={"client": other_client})

    with pytest.raises(CannotUpdateProposalAmountError):
        services.update_proposal(
            proposal=proposal,
            data={"amount": Decimal("1200.00")},
        )


@pytest.mark.django_db
def test_update_proposal_allows_amount_change_for_sent_proposal(org):
    proposal = ProposalFactory(
        organisation=org,
        amount=Decimal("1000.00"),
        status=Proposal.ProposalStatus.SENT,
    )

    updated = services.update_proposal(
        proposal=proposal,
        data={"amount": Decimal("1200.00")},
    )

    proposal.refresh_from_db()
    assert updated == proposal
    assert proposal.amount == Decimal("1200.00")


@pytest.mark.django_db
def test_transition_proposal_enforces_state_machine_and_dates(org):
    proposal = ProposalFactory(organisation=org)

    sent = services.transition_proposal(
        proposal=proposal,
        new_status=Proposal.ProposalStatus.SENT,
    )

    sent.refresh_from_db()
    assert sent.status == Proposal.ProposalStatus.SENT
    assert sent.sent_date == timezone.localdate()

    won = services.transition_proposal(
        proposal=sent,
        new_status=Proposal.ProposalStatus.WON,
    )

    won.refresh_from_db()
    assert won.status == Proposal.ProposalStatus.WON
    assert won.decision_date == timezone.localdate()


@pytest.mark.django_db
def test_transition_proposal_rejects_invalid_transition(org):
    proposal = ProposalFactory(organisation=org)

    with pytest.raises(InvalidProposalTransitionError):
        services.transition_proposal(
            proposal=proposal,
            new_status=Proposal.ProposalStatus.WON,
        )


@pytest.mark.django_db
def test_get_proposal_detail_is_organisation_scoped(org):
    proposal = ProposalFactory(organisation=org)
    other_proposal = ProposalFactory(organisation=OrganisationFactory())

    assert (
        services.get_proposal_detail(
            organisation=org,
            proposal_id=str(proposal.id),
        )
        == proposal
    )

    with pytest.raises(Proposal.DoesNotExist):
        services.get_proposal_detail(
            organisation=org,
            proposal_id=str(other_proposal.id),
        )


@pytest.mark.django_db
def test_delete_proposal_hard_deletes_draft_and_rejects_non_draft(org):
    draft = ProposalFactory(organisation=org, status=Proposal.ProposalStatus.DRAFT)
    sent = ProposalFactory(organisation=org, status=Proposal.ProposalStatus.SENT)

    services.delete_proposal(proposal=draft)

    assert not Proposal.objects.filter(id=draft.id).exists()
    with pytest.raises(CannotDeleteProposalError):
        services.delete_proposal(proposal=sent)
    assert Proposal.objects.filter(id=sent.id).exists()


@pytest.mark.django_db
def test_convert_proposal_to_project_creates_minimal_project_from_won_proposal(org):
    proposal = ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.WON,
        title="Won Proposal",
        description="Delivery scope.",
        amount=Decimal("4500.00"),
    )

    project = services.convert_proposal_to_project(
        proposal=proposal,
        data={
            "start_date": timezone.localdate(),
            "due_date": timezone.localdate() + timedelta(days=30),
        },
    )

    assert project.organisation == org
    assert project.client == proposal.client
    assert project.proposal == proposal
    assert project.title == "Won Proposal"
    assert project.description == "Delivery scope."
    assert project.budget == Decimal("4500.00")


@pytest.mark.django_db
def test_convert_proposal_to_project_allows_title_override(org):
    proposal = ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.WON,
        title="Proposal Title",
    )

    project = services.convert_proposal_to_project(
        proposal=proposal,
        data={
            "title": "Project Title",
            "start_date": timezone.localdate(),
            "due_date": timezone.localdate() + timedelta(days=30),
        },
    )

    assert project.title == "Project Title"


@pytest.mark.django_db
def test_convert_proposal_to_project_rejects_non_won_or_duplicate_conversion(org):
    sent = ProposalFactory(organisation=org, status=Proposal.ProposalStatus.SENT)

    with pytest.raises(CannotConvertProposalError):
        services.convert_proposal_to_project(
            proposal=sent,
            data={
                "start_date": timezone.localdate(),
                "due_date": timezone.localdate() + timedelta(days=30),
            },
        )

    won = ProposalFactory(organisation=org, status=Proposal.ProposalStatus.WON)
    services.convert_proposal_to_project(
        proposal=won,
        data={
            "start_date": timezone.localdate(),
            "due_date": timezone.localdate() + timedelta(days=30),
        },
    )

    with pytest.raises(CannotConvertProposalError):
        services.convert_proposal_to_project(
            proposal=won,
            data={
                "start_date": timezone.localdate(),
                "due_date": timezone.localdate() + timedelta(days=30),
            },
        )

    assert Project.objects.filter(proposal=won).count() == 1
