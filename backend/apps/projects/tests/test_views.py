from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.projects.factories import ProjectFactory
from apps.projects.models import Project
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
