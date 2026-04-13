from datetime import timedelta
from decimal import Decimal

import factory
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.proposals.models import Proposal


class ProposalFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Proposal

    organisation = factory.SubFactory(OrganisationFactory)
    client = factory.SubFactory(
        ClientFactory,
        organisation=factory.SelfAttribute("..organisation"),
    )
    title = factory.Sequence(lambda number: f"Proposal {number}")
    description = factory.Sequence(lambda number: f"Proposal description {number}")
    amount = Decimal("1000.00")
    status = Proposal.ProposalStatus.DRAFT
    sent_date = None
    deadline = factory.LazyFunction(lambda: timezone.localdate() + timedelta(days=14))
    decision_date = None
    notes = ""
