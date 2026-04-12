from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.proposals.factories import ProposalFactory
from apps.proposals.models import Proposal


@pytest.mark.django_db
def test_list_proposals_returns_only_own_organisation_proposals(
    authenticated_client,
    org,
):
    own_proposal = ProposalFactory(organisation=org, title="Own Proposal")
    ProposalFactory(organisation=OrganisationFactory(), title="Other Proposal")

    response = authenticated_client.get(reverse("proposal-list"))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(own_proposal.id)
    assert payload["results"][0]["title"] == "Own Proposal"


@pytest.mark.django_db
def test_list_proposals_filters_by_status_client_id_and_deadline_ordering(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    matching = ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=1),
    )
    ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.DRAFT,
        deadline=timezone.localdate() + timedelta(days=2),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=3),
    )

    response = authenticated_client.get(
        reverse("proposal-list"),
        {
            "status": Proposal.ProposalStatus.SENT,
            "client_id": str(client.id),
            "ordering": "deadline",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(matching.id)


@pytest.mark.django_db
def test_create_proposal_accepts_client_id_and_creates_draft(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)

    response = authenticated_client.post(
        reverse("proposal-list"),
        {
            "client_id": str(client.id),
            "title": "New Proposal",
            "description": "Build a school portal.",
            "amount": "2500.00",
            "deadline": str(timezone.localdate() + timedelta(days=14)),
            "notes": "Created through route test.",
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    proposal = Proposal.objects.get(id=payload["id"])
    assert payload["title"] == "New Proposal"
    assert payload["client"] == str(client.id)
    assert proposal.organisation == org
    assert proposal.client == client
    assert proposal.amount == Decimal("2500.00")
    assert proposal.status == Proposal.ProposalStatus.DRAFT


@pytest.mark.django_db
def test_create_proposal_rejects_wrong_organisation_client(
    authenticated_client,
):
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.post(
        reverse("proposal-list"),
        {
            "client_id": str(other_client.id),
            "title": "Bad Proposal",
            "description": "This client belongs to another organisation.",
            "amount": "2500.00",
            "deadline": str(timezone.localdate() + timedelta(days=14)),
            "notes": "",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "client_id" in response.json()
    assert Proposal.objects.count() == 0


@pytest.mark.django_db
def test_create_proposal_rejects_invalid_amount_and_past_deadline(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)

    response = authenticated_client.post(
        reverse("proposal-list"),
        {
            "client_id": str(client.id),
            "title": "Invalid Proposal",
            "description": "Bad amount and deadline.",
            "amount": "0.00",
            "deadline": str(timezone.localdate() - timedelta(days=1)),
            "notes": "",
        },
        format="json",
    )

    assert response.status_code == 400
    payload = response.json()
    assert "amount" in payload
    assert "deadline" in payload


@pytest.mark.django_db
def test_retrieve_proposal_is_organisation_scoped(authenticated_client, org):
    proposal = ProposalFactory(organisation=org, title="Detail Proposal")
    other_proposal = ProposalFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("proposal-detail", kwargs={"pk": proposal.id}),
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(proposal.id)
    assert response.json()["title"] == "Detail Proposal"

    response = authenticated_client.get(
        reverse("proposal-detail", kwargs={"pk": other_proposal.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_patch_proposal_updates_fields_and_rejects_locked_amount(
    authenticated_client,
    org,
):
    draft = ProposalFactory(organisation=org, title="Old Title")

    response = authenticated_client.patch(
        reverse("proposal-detail", kwargs={"pk": draft.id}),
        {
            "title": "Updated Title",
            "amount": "1200.00",
        },
        format="json",
    )

    draft.refresh_from_db()
    assert response.status_code == 200
    assert draft.title == "Updated Title"
    assert draft.amount == Decimal("1200.00")

    negotiating = ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.NEGOTIATING,
        amount=Decimal("1000.00"),
    )

    response = authenticated_client.patch(
        reverse("proposal-detail", kwargs={"pk": negotiating.id}),
        {"amount": "1500.00"},
        format="json",
    )

    negotiating.refresh_from_db()
    assert response.status_code == 400
    assert negotiating.amount == Decimal("1000.00")


@pytest.mark.django_db
def test_patch_proposal_rejects_cross_organisation_client(
    authenticated_client,
    org,
):
    proposal = ProposalFactory(organisation=org)
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.patch(
        reverse("proposal-detail", kwargs={"pk": proposal.id}),
        {"client_id": str(other_client.id)},
        format="json",
    )

    proposal.refresh_from_db()
    assert response.status_code == 400
    assert "client_id" in response.json()
    assert proposal.client_id != other_client.id


@pytest.mark.django_db
def test_transition_proposal_route_enforces_state_machine_and_dates(
    authenticated_client,
    org,
):
    proposal = ProposalFactory(organisation=org)

    response = authenticated_client.post(
        reverse("proposal-update-status", kwargs={"pk": proposal.id}),
        {"status": Proposal.ProposalStatus.SENT},
        format="json",
    )

    proposal.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["status"] == Proposal.ProposalStatus.SENT
    assert proposal.status == Proposal.ProposalStatus.SENT
    assert proposal.sent_date == timezone.localdate()

    response = authenticated_client.post(
        reverse("proposal-update-status", kwargs={"pk": proposal.id}),
        {"status": Proposal.ProposalStatus.LOST},
        format="json",
    )

    proposal.refresh_from_db()
    assert response.status_code == 200
    assert proposal.status == Proposal.ProposalStatus.LOST
    assert proposal.decision_date == timezone.localdate()


@pytest.mark.django_db
def test_transition_proposal_route_rejects_invalid_transition(
    authenticated_client,
    org,
):
    proposal = ProposalFactory(organisation=org)

    response = authenticated_client.post(
        reverse("proposal-update-status", kwargs={"pk": proposal.id}),
        {"status": Proposal.ProposalStatus.WON},
        format="json",
    )

    proposal.refresh_from_db()
    assert response.status_code == 400
    assert proposal.status == Proposal.ProposalStatus.DRAFT


@pytest.mark.django_db
def test_delete_proposal_hard_deletes_draft_and_rejects_non_draft(
    authenticated_client,
    org,
):
    draft = ProposalFactory(organisation=org, status=Proposal.ProposalStatus.DRAFT)
    sent = ProposalFactory(organisation=org, status=Proposal.ProposalStatus.SENT)

    response = authenticated_client.delete(
        reverse("proposal-detail", kwargs={"pk": draft.id}),
    )

    assert response.status_code == 204
    assert not Proposal.objects.filter(id=draft.id).exists()

    response = authenticated_client.delete(
        reverse("proposal-detail", kwargs={"pk": sent.id}),
    )

    assert response.status_code == 400
    assert Proposal.objects.filter(id=sent.id).exists()
