from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory, UserFactory
from apps.clients.factories import ClientFactory
from apps.invoices.factories import ProjectInvoiceFactory
from apps.projects import services
from apps.projects.exceptions import (
    InvalidProjectBudgetError,
    InvalidProjectClientError,
    InvalidProjectDateRangeError,
    InvalidProjectProposalError,
)
from apps.projects.factories import MilestoneFactory, ProjectFactory, TimeLogFactory
from apps.projects.models import Milestone, Project, TimeLog
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
def test_create_project_creates_nested_milestones(org):
    client = ClientFactory(organisation=org)
    due_date = timezone.localdate() + timedelta(days=14)

    project = services.create_project(
        organisation=org,
        data={
            "client": client,
            "title": "Delivery project",
            "description": "Has milestones at creation.",
            "start_date": timezone.localdate(),
            "due_date": due_date,
            "budget": Decimal("2500.00"),
            "milestones": [
                {
                    "title": "Kickoff",
                    "description": "Initial workshop.",
                    "due_date": timezone.localdate() + timedelta(days=2),
                    "completed": False,
                    "order": 0,
                },
                {
                    "title": "Delivery",
                    "description": "",
                    "due_date": due_date,
                    "completed": True,
                    "order": 1,
                },
            ],
        },
    )

    milestones = list(project.milestones.order_by("order"))
    assert len(milestones) == 2
    assert milestones[0].title == "Kickoff"
    assert milestones[0].description == "Initial workshop."
    assert milestones[0].is_completed is False
    assert milestones[0].completed_at is None
    assert milestones[1].title == "Delivery"
    assert milestones[1].is_completed is True
    assert milestones[1].completed_at is not None


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


@pytest.mark.django_db
def test_list_project_milestones_returns_only_project_rows_in_order(org):
    project = ProjectFactory(organisation=org)
    first = MilestoneFactory(
        project=project,
        order=1,
        due_date=timezone.localdate() + timedelta(days=1),
    )
    second = MilestoneFactory(
        project=project,
        order=2,
        due_date=timezone.localdate() + timedelta(days=2),
    )
    MilestoneFactory(project=ProjectFactory(organisation=org), order=0)

    queryset = services.list_project_milestones(
        organisation=org,
        project_id=str(project.id),
    )

    assert list(queryset) == [first, second]


@pytest.mark.django_db
def test_update_project_milestone_sets_and_clears_completed_at(org):
    milestone = MilestoneFactory(project=ProjectFactory(organisation=org))

    updated = services.update_project_milestone(
        milestone=milestone,
        data={"is_completed": True},
    )

    milestone.refresh_from_db()
    assert updated == milestone
    assert milestone.is_completed is True
    assert milestone.completed_at is not None

    services.update_project_milestone(
        milestone=milestone,
        data={"is_completed": False},
    )

    milestone.refresh_from_db()
    assert milestone.is_completed is False
    assert milestone.completed_at is None


@pytest.mark.django_db
def test_get_project_milestone_is_scoped_by_project_and_organisation(org):
    project = ProjectFactory(organisation=org)
    milestone = MilestoneFactory(project=project)
    other_milestone = MilestoneFactory(project=ProjectFactory(organisation=org))

    assert services.get_project_milestone(
        organisation=org,
        project_id=str(project.id),
        milestone_id=str(milestone.id),
    ) == milestone

    with pytest.raises(Milestone.DoesNotExist):
        services.get_project_milestone(
            organisation=org,
            project_id=str(project.id),
            milestone_id=str(other_milestone.id),
        )


@pytest.mark.django_db
def test_delete_project_milestone_removes_row(org):
    milestone = MilestoneFactory(project=ProjectFactory(organisation=org))

    services.delete_project_milestone(milestone=milestone)

    assert not Milestone.objects.filter(id=milestone.id).exists()


@pytest.mark.django_db
def test_list_time_logs_filters_by_project_date_range_and_billable(org):
    project = ProjectFactory(organisation=org)
    matching = TimeLogFactory(
        project=project,
        log_date=timezone.localdate(),
        is_billable=True,
    )
    TimeLogFactory(
        project=project,
        log_date=timezone.localdate() - timedelta(days=5),
        is_billable=True,
    )
    TimeLogFactory(
        project=project,
        log_date=timezone.localdate(),
        is_billable=False,
    )
    TimeLogFactory(project=ProjectFactory(organisation=org), is_billable=True)

    queryset = services.list_time_logs(
        organisation=org,
        filters={
            "project_id": str(project.id),
            "log_date__gte": timezone.localdate() - timedelta(days=1),
            "log_date__lte": timezone.localdate() + timedelta(days=1),
            "billable": "true",
        },
    )

    assert list(queryset) == [matching]


@pytest.mark.django_db
def test_create_time_log_attaches_user_and_rejects_project_from_other_org(org):
    user = UserFactory(organisation=org)
    project = ProjectFactory(organisation=org)

    time_log = services.create_time_log(
        organisation=org,
        user=user,
        data={
            "project": project,
            "log_date": timezone.localdate(),
            "hours": Decimal("4.00"),
            "description": "Implementation work.",
            "is_billable": False,
        },
    )

    assert time_log.project == project
    assert time_log.user == user
    assert time_log.hours == Decimal("4.00")
    assert time_log.is_billable is False

    other_project = ProjectFactory(organisation=OrganisationFactory())
    with pytest.raises(Project.DoesNotExist):
        services.create_time_log(
            organisation=org,
            user=user,
            data={
                "project": other_project,
                "log_date": timezone.localdate(),
                "hours": Decimal("1.00"),
                "description": "Wrong tenant.",
                "is_billable": True,
            },
        )


@pytest.mark.django_db
def test_list_project_time_logs_returns_expected_aggregates(org):
    project = ProjectFactory(organisation=org, budget=Decimal("1200.00"))
    billable = TimeLogFactory(
        project=project,
        hours=Decimal("3.00"),
        is_billable=True,
        log_date=timezone.localdate(),
    )
    non_billable = TimeLogFactory(
        project=project,
        hours=Decimal("1.50"),
        is_billable=False,
        log_date=timezone.localdate() - timedelta(days=1),
    )
    TimeLogFactory(project=ProjectFactory(organisation=org), hours=Decimal("9.00"))

    payload = services.list_project_time_logs(
        organisation=org,
        project_id=str(project.id),
    )

    assert list(payload["queryset"]) == [billable, non_billable]
    assert payload["total_hours"] == Decimal("4.50")
    assert payload["billable_hours"] == Decimal("3.00")
    assert payload["non_billable_hours"] == Decimal("1.50")
    assert payload["effective_rate"] == Decimal("400.00")


@pytest.mark.django_db
def test_get_time_log_detail_is_organisation_scoped(org):
    time_log = TimeLogFactory(project=ProjectFactory(organisation=org))
    other_time_log = TimeLogFactory(
        project=ProjectFactory(organisation=OrganisationFactory())
    )

    assert services.get_time_log_detail(
        organisation=org,
        time_log_id=str(time_log.id),
    ) == time_log

    with pytest.raises(TimeLog.DoesNotExist):
        services.get_time_log_detail(
            organisation=org,
            time_log_id=str(other_time_log.id),
        )


@pytest.mark.django_db
def test_update_time_log_rejects_project_from_other_organisation(org):
    time_log = TimeLogFactory(project=ProjectFactory(organisation=org))
    other_project = ProjectFactory(organisation=OrganisationFactory())

    with pytest.raises(Project.DoesNotExist):
        services.update_time_log(
            time_log=time_log,
            data={"project": other_project},
        )

    assert TimeLog.objects.filter(id=time_log.id).exists()


@pytest.mark.django_db
def test_delete_time_log_removes_row(org):
    time_log = TimeLogFactory(project=ProjectFactory(organisation=org))

    services.delete_time_log(time_log=time_log)

    assert not TimeLog.objects.filter(id=time_log.id).exists()


@pytest.mark.django_db
def test_list_project_time_logs_returns_zero_aggregates_when_empty(org):
    project = ProjectFactory(organisation=org, budget=Decimal("500.00"))

    payload = services.list_project_time_logs(
        organisation=org,
        project_id=str(project.id),
    )

    assert list(payload["queryset"]) == []
    assert payload["total_hours"] == Decimal("0.00")
    assert payload["billable_hours"] == Decimal("0.00")
    assert payload["non_billable_hours"] == Decimal("0.00")
    assert payload["effective_rate"] == Decimal("0.00")


@pytest.mark.django_db
def test_list_project_invoices_returns_project_scoped_invoice_rows(org):
    project = ProjectFactory(organisation=org)
    own_invoice = ProjectInvoiceFactory(
        organisation=org,
        client=project.client,
        project=project,
    )
    ProjectInvoiceFactory(organisation=org)

    queryset = services.list_project_invoices(
        organisation=org,
        project_id=str(project.id),
    )

    assert list(queryset) == [own_invoice]
