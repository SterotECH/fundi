from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.invoices.factories import ProjectInvoiceFactory
from apps.projects.factories import MilestoneFactory, ProjectFactory, TimeLogFactory
from apps.projects.models import Milestone, Project, TimeLog
from apps.proposals.factories import ProposalFactory


@pytest.mark.django_db
def test_list_projects_returns_only_own_organisation_projects(
    authenticated_client,
    org,
):
    own_project = ProjectFactory(organisation=org, title="Own Project")
    ProjectFactory(organisation=OrganisationFactory(), title="Other Project")

    response = authenticated_client.get(reverse("project-list"))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(own_project.id)
    assert payload["results"][0]["title"] == "Own Project"


@pytest.mark.django_db
def test_list_projects_filters_by_status_client_id_and_due_date_ordering(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    matching = ProjectFactory(
        organisation=org,
        client=client,
        status=Project.ProjectStatus.ACTIVE,
        due_date=timezone.localdate() + timedelta(days=1),
    )
    ProjectFactory(
        organisation=org,
        client=client,
        status=Project.ProjectStatus.PLANNING,
        due_date=timezone.localdate() + timedelta(days=2),
    )
    ProjectFactory(
        organisation=org,
        status=Project.ProjectStatus.ACTIVE,
        due_date=timezone.localdate() + timedelta(days=3),
    )

    response = authenticated_client.get(
        reverse("project-list"),
        {
            "status": Project.ProjectStatus.ACTIVE,
            "client_id": str(client.id),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(matching.id)


@pytest.mark.django_db
def test_create_project_accepts_client_id_and_optional_proposal_id(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    proposal = ProposalFactory(organisation=org, client=client)

    response = authenticated_client.post(
        reverse("project-list"),
        {
            "client_id": str(client.id),
            "proposal_id": str(proposal.id),
            "title": "New Project",
            "description": "Project created manually.",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() + timedelta(days=14)),
            "budget": "2500.00",
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    project = Project.objects.get(id=payload["id"])
    assert payload["title"] == "New Project"
    assert payload["client"] == str(client.id)
    assert payload["proposal"] == str(proposal.id)
    assert project.organisation == org
    assert project.client == client
    assert project.proposal == proposal
    assert project.status == Project.ProjectStatus.PLANNING
    assert project.budget == Decimal("2500.00")


@pytest.mark.django_db
def test_create_project_accepts_nested_milestones(authenticated_client, org):
    client = ClientFactory(organisation=org)

    response = authenticated_client.post(
        reverse("project-list"),
        {
            "client_id": str(client.id),
            "title": "New Project",
            "description": "Project created with milestones.",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() + timedelta(days=14)),
            "budget": "2500.00",
            "milestones": [
                {
                    "title": "Kickoff",
                    "description": "Initial workshop.",
                    "due_date": str(timezone.localdate() + timedelta(days=2)),
                    "order": 0,
                },
                {
                    "title": "Handover",
                    "description": "",
                    "due_date": str(timezone.localdate() + timedelta(days=14)),
                    "completed": True,
                    "order": 1,
                },
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert [item["title"] for item in payload["milestones"]] == ["Kickoff", "Handover"]
    assert payload["milestones"][0]["completed"] is False
    assert payload["milestones"][1]["completed"] is True
    assert Milestone.objects.filter(project_id=payload["id"]).count() == 2


@pytest.mark.django_db
def test_create_project_rejects_wrong_organisation_client(authenticated_client):
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.post(
        reverse("project-list"),
        {
            "client_id": str(other_client.id),
            "title": "Bad Project",
            "description": "Wrong tenant client.",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() + timedelta(days=14)),
            "budget": "2500.00",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "client_id" in response.json()
    assert Project.objects.count() == 0


@pytest.mark.django_db
def test_create_project_rejects_invalid_budget_and_date_range(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)

    response = authenticated_client.post(
        reverse("project-list"),
        {
            "client_id": str(client.id),
            "title": "Invalid Project",
            "description": "Bad scalar values.",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() - timedelta(days=1)),
            "budget": "0.00",
        },
        format="json",
    )

    assert response.status_code == 400
    payload = response.json()
    assert "budget" in payload

    response = authenticated_client.post(
        reverse("project-list"),
        {
            "client_id": str(client.id),
            "title": "Invalid Project",
            "description": "Bad date range.",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() - timedelta(days=1)),
            "budget": "2500.00",
        },
        format="json",
    )

    assert response.status_code == 400
    payload = response.json()
    assert "due_date" in payload


@pytest.mark.django_db
def test_create_project_rejects_proposal_for_another_client(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    other_client = ClientFactory(organisation=org)
    proposal = ProposalFactory(organisation=org, client=other_client)

    response = authenticated_client.post(
        reverse("project-list"),
        {
            "client_id": str(client.id),
            "proposal_id": str(proposal.id),
            "title": "Bad Project",
            "description": "Mismatched proposal.",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() + timedelta(days=14)),
            "budget": "2500.00",
        },
        format="json",
    )

    assert response.status_code == 400
    assert Project.objects.count() == 0


@pytest.mark.django_db
def test_retrieve_project_is_organisation_scoped(authenticated_client, org):
    project = ProjectFactory(organisation=org, title="Detail Project")
    other_project = ProjectFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("project-detail", kwargs={"pk": project.id}),
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(project.id)
    assert response.json()["title"] == "Detail Project"

    response = authenticated_client.get(
        reverse("project-detail", kwargs={"pk": other_project.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_project_detail_includes_milestones_and_time_summary(authenticated_client, org):
    project = ProjectFactory(organisation=org, budget=Decimal("600.00"))
    milestone = MilestoneFactory(project=project, title="Scope approval")
    TimeLogFactory(
        project=project,
        hours=Decimal("2.00"),
        is_billable=True,
    )
    TimeLogFactory(
        project=project,
        hours=Decimal("1.00"),
        is_billable=False,
    )

    response = authenticated_client.get(
        reverse("project-detail", kwargs={"pk": project.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["milestones"][0]["id"] == str(milestone.id)
    assert payload["time_summary"] == {
        "total_hours": "3.00",
        "billable_hours": "2.00",
        "non_billable_hours": "1.00",
        "effective_rate": "300.00",
    }


@pytest.mark.django_db
def test_patch_project_updates_fields(authenticated_client, org):
    project = ProjectFactory(organisation=org, title="Old Title")

    response = authenticated_client.patch(
        reverse("project-detail", kwargs={"pk": project.id}),
        {
            "title": "Updated Title",
            "status": Project.ProjectStatus.ACTIVE,
            "budget": "1200.00",
        },
        format="json",
    )

    project.refresh_from_db()
    assert response.status_code == 200
    assert project.title == "Updated Title"
    assert project.status == Project.ProjectStatus.ACTIVE
    assert project.budget == Decimal("1200.00")


@pytest.mark.django_db
def test_patch_project_rejects_cross_organisation_client(
    authenticated_client,
    org,
):
    project = ProjectFactory(organisation=org)
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.patch(
        reverse("project-detail", kwargs={"pk": project.id}),
        {"client_id": str(other_client.id)},
        format="json",
    )

    project.refresh_from_db()
    assert response.status_code == 400
    assert "client_id" in response.json()
    assert project.client_id != other_client.id


@pytest.mark.django_db
def test_patch_project_rejects_client_change_that_conflicts_with_existing_proposal(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    proposal = ProposalFactory(organisation=org, client=client)
    project = ProjectFactory(organisation=org, client=client, proposal=proposal)
    other_client = ClientFactory(organisation=org)

    response = authenticated_client.patch(
        reverse("project-detail", kwargs={"pk": project.id}),
        {"client_id": str(other_client.id)},
        format="json",
    )

    project.refresh_from_db()
    assert response.status_code == 400
    assert project.client == client
    assert project.proposal == proposal


@pytest.mark.django_db
def test_delete_project_method_is_not_allowed(authenticated_client, org):
    project = ProjectFactory(organisation=org)

    response = authenticated_client.delete(
        reverse("project-detail", kwargs={"pk": project.id}),
    )

    assert response.status_code == 405
    assert Project.objects.filter(id=project.id).exists()


@pytest.mark.django_db
def test_list_project_milestones_is_project_scoped(authenticated_client, org):
    project = ProjectFactory(organisation=org)
    milestone = MilestoneFactory(project=project, title="Kickoff")
    MilestoneFactory(project=ProjectFactory(organisation=org), title="Other")

    response = authenticated_client.get(
        reverse("project-milestones", kwargs={"pk": project.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(milestone.id)
    assert payload[0]["title"] == "Kickoff"


@pytest.mark.django_db
def test_create_project_milestone_uses_url_project_and_accepts_description(
    authenticated_client,
    org,
):
    project = ProjectFactory(organisation=org)

    response = authenticated_client.post(
        reverse("project-milestones", kwargs={"pk": project.id}),
        {
            "title": "Delivery sign-off",
            "description": "Final acceptance checklist.",
            "due_date": str(timezone.localdate() + timedelta(days=10)),
            "order": 3,
        },
        format="json",
    )

    assert response.status_code == 201
    milestone = Milestone.objects.get(id=response.json()["id"])
    assert milestone.project == project
    assert milestone.description == "Final acceptance checklist."
    assert response.json()["completed"] is False


@pytest.mark.django_db
def test_patch_project_milestone_updates_completed_and_description(
    authenticated_client,
    org,
):
    milestone = MilestoneFactory(
        project=ProjectFactory(organisation=org),
        is_completed=False,
        description="Old note",
    )

    response = authenticated_client.patch(
        reverse(
            "project-milestone-detail",
            kwargs={"pk": milestone.project_id, "milestone_id": milestone.id},
        ),
        {
            "completed": True,
            "description": "New note",
        },
        format="json",
    )

    milestone.refresh_from_db()
    assert response.status_code == 200
    assert milestone.is_completed is True
    assert milestone.completed_at is not None
    assert milestone.description == "New note"


@pytest.mark.django_db
def test_delete_project_milestone_removes_row(authenticated_client, org):
    milestone = MilestoneFactory(project=ProjectFactory(organisation=org))

    response = authenticated_client.delete(
        reverse(
            "project-milestone-detail",
            kwargs={"pk": milestone.project_id, "milestone_id": milestone.id},
        ),
    )

    assert response.status_code == 204
    assert not Milestone.objects.filter(id=milestone.id).exists()


@pytest.mark.django_db
def test_project_milestone_detail_returns_404_for_other_organisation(
    authenticated_client,
):
    other_milestone = MilestoneFactory(
        project=ProjectFactory(organisation=OrganisationFactory())
    )

    response = authenticated_client.patch(
        reverse(
            "project-milestone-detail",
            kwargs={
                "pk": other_milestone.project_id,
                "milestone_id": other_milestone.id,
            },
        ),
        {"completed": True},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_project_milestone_rejects_missing_title(authenticated_client, org):
    project = ProjectFactory(organisation=org)

    response = authenticated_client.post(
        reverse("project-milestones", kwargs={"pk": project.id}),
        {
            "description": "No title provided.",
            "due_date": str(timezone.localdate() + timedelta(days=10)),
            "order": 1,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "title" in response.json()


@pytest.mark.django_db
def test_list_timelogs_filters_by_project_and_billable(authenticated_client, org):
    project = ProjectFactory(organisation=org)
    matching = TimeLogFactory(project=project, is_billable=True)
    TimeLogFactory(project=project, is_billable=False)
    TimeLogFactory(project=ProjectFactory(organisation=org), is_billable=True)

    response = authenticated_client.get(
        reverse("timelog-list"),
        {
            "project_id": str(project.id),
            "billable": "true",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(matching.id)
    assert payload["results"][0]["billable"] is True


@pytest.mark.django_db
def test_create_timelog_accepts_billable_alias(authenticated_client, org):
    project = ProjectFactory(organisation=org)

    response = authenticated_client.post(
        reverse("timelog-list"),
        {
            "project_id": str(project.id),
            "log_date": str(timezone.localdate()),
            "hours": "3.25",
            "description": "Internal review",
            "billable": False,
        },
        format="json",
    )

    assert response.status_code == 201
    time_log = TimeLog.objects.get(id=response.json()["id"])
    assert time_log.project == project
    assert time_log.is_billable is False
    assert response.json()["billable"] is False


@pytest.mark.django_db
def test_create_timelog_rejects_invalid_hours_and_other_org_project(
    authenticated_client,
    org,
):
    project = ProjectFactory(organisation=org)
    other_project = ProjectFactory(organisation=OrganisationFactory())

    response = authenticated_client.post(
        reverse("timelog-list"),
        {
            "project_id": str(project.id),
            "log_date": str(timezone.localdate()),
            "hours": "0.00",
            "description": "Invalid hours",
            "billable": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "hours" in response.json()

    response = authenticated_client.post(
        reverse("timelog-list"),
        {
            "project_id": str(other_project.id),
            "log_date": str(timezone.localdate()),
            "hours": "1.00",
            "description": "Wrong project",
            "billable": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "project_id" in response.json()


@pytest.mark.django_db
def test_patch_timelog_updates_fields(authenticated_client, org):
    time_log = TimeLogFactory(project=ProjectFactory(organisation=org))

    response = authenticated_client.patch(
        reverse("timelog-detail", kwargs={"pk": time_log.id}),
        {
            "hours": "5.00",
            "billable": False,
            "description": "Updated work log",
        },
        format="json",
    )

    time_log.refresh_from_db()
    assert response.status_code == 200
    assert time_log.hours == Decimal("5.00")
    assert time_log.is_billable is False
    assert time_log.description == "Updated work log"


@pytest.mark.django_db
def test_delete_timelog_removes_row(authenticated_client, org):
    time_log = TimeLogFactory(project=ProjectFactory(organisation=org))

    response = authenticated_client.delete(
        reverse("timelog-detail", kwargs={"pk": time_log.id}),
    )

    assert response.status_code == 204
    assert not TimeLog.objects.filter(id=time_log.id).exists()


@pytest.mark.django_db
def test_retrieve_timelog_returns_404_for_other_organisation(authenticated_client):
    other_time_log = TimeLogFactory(
        project=ProjectFactory(organisation=OrganisationFactory())
    )

    response = authenticated_client.get(
        reverse("timelog-detail", kwargs={"pk": other_time_log.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_project_timelogs_returns_results_and_aggregates(authenticated_client, org):
    project = ProjectFactory(organisation=org, budget=Decimal("900.00"))
    first = TimeLogFactory(
        project=project,
        hours=Decimal("2.00"),
        is_billable=True,
        log_date=timezone.localdate(),
    )
    second = TimeLogFactory(
        project=project,
        hours=Decimal("1.00"),
        is_billable=False,
        log_date=timezone.localdate() - timedelta(days=1),
    )

    response = authenticated_client.get(
        reverse("project-timelogs", kwargs={"pk": project.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_hours"] == "3.00"
    assert payload["billable_hours"] == "2.00"
    assert payload["non_billable_hours"] == "1.00"
    assert payload["effective_rate"] == "450.00"
    assert [row["id"] for row in payload["results"]] == [
        str(first.id),
        str(second.id),
    ]


@pytest.mark.django_db
def test_project_invoices_returns_only_project_linked_invoices(
    authenticated_client,
    org,
):
    project = ProjectFactory(organisation=org)
    own_invoice = ProjectInvoiceFactory(
        organisation=org,
        client=project.client,
        project=project,
    )
    ProjectInvoiceFactory(organisation=org)

    response = authenticated_client.get(
        reverse("project-invoices", kwargs={"pk": project.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(own_invoice.id)
    assert payload[0]["client"] == str(project.client_id)


@pytest.mark.django_db
def test_project_invoices_returns_404_for_other_organisation(authenticated_client):
    other_project = ProjectFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("project-invoices", kwargs={"pk": other_project.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_project_timelogs_returns_zero_aggregates_when_empty(authenticated_client, org):
    project = ProjectFactory(organisation=org, budget=Decimal("900.00"))

    response = authenticated_client.get(
        reverse("project-timelogs", kwargs={"pk": project.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_hours"] == "0.00"
    assert payload["billable_hours"] == "0.00"
    assert payload["non_billable_hours"] == "0.00"
    assert payload["effective_rate"] == "0.00"
    assert payload["results"] == []
