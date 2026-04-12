from decimal import Decimal

import pytest

from apps.clients.factories import ClientFactory
from apps.proposals.factories import ProposalFactory
from apps.proposals.models import Proposal


@pytest.mark.django_db
def test_proposal_factory_creates_draft_proposal_in_client_organisation():
    client = ClientFactory()

    proposal = ProposalFactory(client=client, organisation=client.organisation)

    assert proposal.id is not None
    assert proposal.organisation == client.organisation
    assert proposal.client == client
    assert proposal.status == Proposal.ProposalStatus.DRAFT
    assert proposal.amount == Decimal("1000.00")
    assert proposal.sent_date is None
    assert proposal.decision_date is None


@pytest.mark.django_db
def test_proposal_status_choices_match_documented_pipeline():
    values = {value for value, _label in Proposal.ProposalStatus.choices}

    assert values == {
        "draft",
        "sent",
        "negotiating",
        "won",
        "lost",
    }
