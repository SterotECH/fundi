from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.projects.factories import ProjectFactory
from apps.projects.models import Project
from apps.proposals.factories import ProposalFactory
from apps.proposals.models import Proposal


@pytest.mark.django_db
def test_audit_log_is_created_when_audited_model_is_created(org):
    client = ClientFactory(organisation=org, name="Audit Client")

    audit_log = AuditLog.objects.filter(
        entity_type="Client",
        entity_id=client.id,
        action=AuditLog.Action.CREATED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["name"]["after"] == "Audit Client"


@pytest.mark.django_db
def test_audit_log_records_status_changed_updates(org):
    project = ProjectFactory(organisation=org, status=Project.ProjectStatus.PLANNING)

    project.status = Project.ProjectStatus.ACTIVE
    project.save()

    audit_log = AuditLog.objects.filter(
        entity_type="Project",
        entity_id=project.id,
        action=AuditLog.Action.STATUS_CHANGED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["status"] == {
        "before": Project.ProjectStatus.PLANNING,
        "after": Project.ProjectStatus.ACTIVE,
    }


@pytest.mark.django_db
def test_audit_log_records_deletes(org):
    client = ClientFactory(organisation=org, name="Deleted Client")
    client_id = client.id

    client.delete()

    audit_log = AuditLog.objects.filter(
        entity_type="Client",
        entity_id=client_id,
        action=AuditLog.Action.DELETED,
    ).latest("timestamp")

    assert audit_log.organisation == org
    assert audit_log.diff["name"]["before"] == "Deleted Client"
    assert audit_log.diff["name"]["after"] is None


@pytest.mark.django_db
def test_audit_log_records_authenticated_request_user(authenticated_client, user):
    response = authenticated_client.post(
        reverse("client-list"),
        {
            "type": Client.ClientType.SHS,
            "name": "Request Audit Client",
            "email": "request-audit@example.com",
            "contact_person": "Request User",
            "phone": "0240000000",
            "address": "Accra",
            "region": "Greater Accra",
            "notes": "Created through authenticated request.",
        },
        format="json",
    )

    assert response.status_code == 201
    audit_log = AuditLog.objects.filter(
        entity_type="Client",
        entity_id=response.json()["id"],
        action=AuditLog.Action.CREATED,
    ).latest("timestamp")
    assert audit_log.user == user


@pytest.mark.django_db
def test_dashboard_api_returns_only_sprint_1_organisation_data(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    upcoming = ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=3),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.DRAFT,
        deadline=timezone.localdate() + timedelta(days=20),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.WON,
        deadline=timezone.localdate() + timedelta(days=2),
    )
    ProposalFactory(organisation=OrganisationFactory())
    active_project = ProjectFactory(
        organisation=org,
        client=client,
        status=Project.ProjectStatus.ACTIVE,
    )
    ProjectFactory(organisation=org, status=Project.ProjectStatus.PLANNING)
    ProjectFactory(organisation=OrganisationFactory(), status=Project.ProjectStatus.ACTIVE)

    response = authenticated_client.get(reverse("dashboard"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["proposal_counts"][Proposal.ProposalStatus.SENT] == 1
    assert payload["proposal_counts"][Proposal.ProposalStatus.DRAFT] == 1
    assert payload["proposal_counts"][Proposal.ProposalStatus.WON] == 1
    assert payload["upcoming_proposal_deadlines"] == [
        {
            "id": str(upcoming.id),
            "title": upcoming.title,
            "client": str(client.id),
            "client_name": client.name,
            "status": Proposal.ProposalStatus.SENT,
            "deadline": upcoming.deadline.isoformat(),
            "amount": "1000.00",
        }
    ]
    assert payload["active_projects"] == [
        {
            "id": str(active_project.id),
            "title": active_project.title,
            "client": str(client.id),
            "client_name": client.name,
            "status": Project.ProjectStatus.ACTIVE,
            "due_date": active_project.due_date.isoformat(),
            "budget": "1000.00",
        }
    ]
    assert "invoices" not in payload
    assert "payments" not in payload
