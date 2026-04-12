from datetime import timedelta
from decimal import Decimal

import factory
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.projects.models import Project


class ProjectFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Project

    organisation = factory.SubFactory(OrganisationFactory)
    client = factory.SubFactory(
        ClientFactory,
        organisation=factory.SelfAttribute("..organisation"),
    )
    proposal = None
    title = factory.Sequence(lambda number: f"Project {number}")
    description = factory.Sequence(lambda number: f"Project description {number}")
    status = Project.ProjectStatus.PLANNING
    start_date = factory.LazyFunction(timezone.localdate)
    due_date = factory.LazyFunction(
        lambda: timezone.localdate() + timedelta(days=30)
    )
    budget = Decimal("1000.00")
