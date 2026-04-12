from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.projects import services
from apps.projects.exceptions import (
    InvalidProjectBudgetError,
    InvalidProjectClientError,
    InvalidProjectDateRangeError,
    InvalidProjectProposalError,
)
from apps.projects.factories import ProjectFactory
from apps.projects.models import Project
from apps.proposals.factories import ProposalFactory


@pytest.mark.django_db
def test_list_projects_returns_only_requested_organisation(org):
    own_project = ProjectFactory(organisation=org, title="Own Project")
    ProjectFactory(organisation=OrganisationFactory(), title="Other Project")

    queryset = services.list_projects(organisation=org, filters={})

    assert list(queryset) == [own_project]


@pytest.mark.django_db
def test_list_projects_filters_by_status_and_client_id(org):
    client = ClientFactory(organisation=org)
    matching_project = ProjectFactory(
        organisation=org,
        client=client,
        status=Project.ProjectStatus.ACTIVE,
    )
    ProjectFactory(
        organisation=org,
        client=client,
        status=Project.ProjectStatus.PLANNING,
    )
    ProjectFactory(
        organisation=org,
        status=Project.ProjectStatus.ACTIVE,
    )

    queryset = services.list_projects(
        organisation=org,
        filters={
            "status": Project.ProjectStatus.ACTIVE,
            "client_id": str(client.id),
        },
    )

    assert list(queryset) == [matching_project]


@pytest.mark.django_db
def test_list_projects_orders_by_due_date(org):
    later = ProjectFactory(
        organisation=org,
        title="Later",
        due_date=timezone.localdate() + timedelta(days=10),
    )
    earlier = ProjectFactory(
        organisation=org,
        title="Earlier",
        due_date=timezone.localdate() + timedelta(days=1),
    )

    queryset = services.list_projects(organisation=org, filters={})

    assert list(queryset) == [earlier, later]


@pytest.mark.django_db
def test_create_project_attaches_organisation_and_accepts_matching_proposal(org):
    client = ClientFactory(organisation=org)
    proposal = ProposalFactory(organisation=org, client=client)

    project = services.create_project(
        organisation=org,
        data={
            "client": client,
            "proposal": proposal,
            "title": "New Project",
            "description": "Delivery work.",
            "start_date": timezone.localdate(),
            "due_date": timezone.localdate() + timedelta(days=14),
            "budget": Decimal("2500.00"),
        },
    )

    assert project.organisation == org
    assert project.client == client
    assert project.proposal == proposal
    assert project.status == Project.ProjectStatus.PLANNING
    assert project.budget == Decimal("2500.00")


@pytest.mark.django_db
def test_create_project_rejects_wrong_client_and_invalid_proposal_links(org):
    client = ClientFactory(organisation=org)
    other_client = ClientFactory(organisation=OrganisationFactory())
    wrong_org_proposal = ProposalFactory(organisation=OrganisationFactory())
    wrong_client_proposal = ProposalFactory(organisation=org)

    valid_data = {
        "client": client,
        "title": "Bad Project",
        "description": "Invalid relationship.",
        "start_date": timezone.localdate(),
        "due_date": timezone.localdate() + timedelta(days=14),
        "budget": Decimal("2500.00"),
    }

    with pytest.raises(InvalidProjectClientError):
        services.create_project(
            organisation=org,
            data={**valid_data, "client": other_client},
        )

    with pytest.raises(InvalidProjectProposalError):
        services.create_project(
            organisation=org,
            data={**valid_data, "proposal": wrong_org_proposal},
        )

    with pytest.raises(InvalidProjectProposalError):
        services.create_project(
            organisation=org,
            data={**valid_data, "proposal": wrong_client_proposal},
        )


@pytest.mark.django_db
def test_create_project_rejects_invalid_budget_and_date_range(org):
    client = ClientFactory(organisation=org)
    valid_data = {
        "client": client,
        "title": "Invalid Project",
        "description": "Bad scalar values.",
        "start_date": timezone.localdate(),
        "due_date": timezone.localdate() + timedelta(days=14),
        "budget": Decimal("2500.00"),
    }

    with pytest.raises(InvalidProjectBudgetError):
        services.create_project(
            organisation=org,
            data={**valid_data, "budget": Decimal("0.00")},
        )

    with pytest.raises(InvalidProjectDateRangeError):
        services.create_project(
            organisation=org,
            data={
                **valid_data,
                "due_date": timezone.localdate() - timedelta(days=1),
            },
        )


@pytest.mark.django_db
def test_get_project_detail_is_organisation_scoped(org):
    project = ProjectFactory(organisation=org)
    other_project = ProjectFactory(organisation=OrganisationFactory())

    assert services.get_project_detail(
        organisation=org,
        project_id=str(project.id),
    ) == project

    with pytest.raises(Project.DoesNotExist):
        services.get_project_detail(
            organisation=org,
            project_id=str(other_project.id),
        )


@pytest.mark.django_db
def test_update_project_mutates_fields_and_allows_matching_client_proposal(org):
    client = ClientFactory(organisation=org)
    proposal = ProposalFactory(organisation=org, client=client)
    project = ProjectFactory(organisation=org, client=client)

    updated = services.update_project(
        project=project,
        data={
            "proposal": proposal,
            "title": "Updated Project",
            "status": Project.ProjectStatus.ACTIVE,
            "budget": Decimal("3500.00"),
        },
    )

    project.refresh_from_db()
    assert updated == project
    assert project.proposal == proposal
    assert project.title == "Updated Project"
    assert project.status == Project.ProjectStatus.ACTIVE
    assert project.budget == Decimal("3500.00")


@pytest.mark.django_db
def test_update_project_rejects_invalid_relationships_and_values(org):
    client = ClientFactory(organisation=org)
    proposal = ProposalFactory(organisation=org, client=client)
    project = ProjectFactory(
        organisation=org,
        client=client,
        proposal=proposal,
    )
    other_org_client = ClientFactory(organisation=OrganisationFactory())
    other_org_proposal = ProposalFactory(organisation=OrganisationFactory())
    wrong_client = ClientFactory(organisation=org)
    wrong_client_proposal = ProposalFactory(organisation=org, client=wrong_client)

    with pytest.raises(InvalidProjectClientError):
        services.update_project(project=project, data={"client": other_org_client})

    with pytest.raises(InvalidProjectProposalError):
        services.update_project(project=project, data={"proposal": other_org_proposal})

    with pytest.raises(InvalidProjectProposalError):
        services.update_project(
            project=project,
            data={"proposal": wrong_client_proposal},
        )

    with pytest.raises(InvalidProjectProposalError):
        services.update_project(project=project, data={"client": wrong_client})

    with pytest.raises(InvalidProjectBudgetError):
        services.update_project(project=project, data={"budget": Decimal("-1.00")})

    with pytest.raises(InvalidProjectDateRangeError):
        services.update_project(
            project=project,
            data={"due_date": project.start_date - timedelta(days=1)},
        )
