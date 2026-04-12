from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.clients.factories import ClientFactory
from apps.projects.factories import MilestoneFactory, ProjectFactory, TimeLogFactory
from apps.projects.models import Project
from apps.proposals.factories import ProposalFactory


@pytest.mark.django_db
def test_project_factory_creates_planning_project_in_client_organisation():
    client = ClientFactory()

    project = ProjectFactory(client=client, organisation=client.organisation)

    assert project.id is not None
    assert project.organisation == client.organisation
    assert project.client == client
    assert project.proposal is None
    assert project.status == Project.ProjectStatus.PLANNING
    assert project.start_date == timezone.localdate()
    assert project.due_date == timezone.localdate() + timedelta(days=30)
    assert project.budget == Decimal("1000.00")


@pytest.mark.django_db
def test_project_can_link_to_nullable_proposal_for_same_client():
    client = ClientFactory()
    proposal = ProposalFactory(client=client, organisation=client.organisation)

    project = ProjectFactory(
        client=client,
        organisation=client.organisation,
        proposal=proposal,
    )

    assert project.proposal == proposal
    assert project.client == proposal.client
    assert project.organisation == proposal.organisation


@pytest.mark.django_db
def test_project_status_choices_match_documented_delivery_states():
    values = {value for value, _label in Project.ProjectStatus.choices}

    assert values == {
        "planning",
        "active",
        "hold",
        "done",
    }


@pytest.mark.django_db
def test_milestone_factory_creates_project_scoped_milestone_with_description():
    milestone = MilestoneFactory(description="Discovery workshop completed.")

    assert milestone.id is not None
    assert milestone.project.organisation == milestone.project.client.organisation
    assert milestone.description == "Discovery workshop completed."
    assert milestone.is_completed is False
    assert milestone.completed_at is None


@pytest.mark.django_db
def test_time_log_factory_keeps_user_in_project_organisation():
    time_log = TimeLogFactory(hours=Decimal("3.50"))

    assert time_log.id is not None
    assert time_log.user.organisation == time_log.project.organisation
    assert time_log.hours == Decimal("3.50")
    assert time_log.is_billable is True
