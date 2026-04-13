from datetime import timedelta
from decimal import Decimal

import factory
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory, UserFactory
from apps.clients.factories import ClientFactory
from apps.projects.models import Milestone, Project, TimeLog


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
    due_date = factory.LazyFunction(lambda: timezone.localdate() + timedelta(days=30))
    budget = Decimal("1000.00")


class MilestoneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Milestone

    project = factory.SubFactory(ProjectFactory)
    title = factory.Sequence(lambda number: f"Milestone {number}")
    description = factory.Sequence(lambda number: f"Milestone note {number}")
    due_date = factory.LazyFunction(lambda: timezone.localdate() + timedelta(days=7))
    is_completed = False
    completed_at = None
    order = factory.Sequence(int)


class TimeLogFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = TimeLog

    project = factory.SubFactory(ProjectFactory)
    user = factory.SubFactory(
        UserFactory,
        organisation=factory.SelfAttribute("..project.organisation"),
    )
    log_date = factory.LazyFunction(timezone.localdate)
    hours = Decimal("2.50")
    description = factory.Sequence(lambda number: f"Time entry {number}")
    is_billable = True
