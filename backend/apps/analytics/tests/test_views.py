from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.invoices.factories import InvoiceFactory, PaymentFactory
from apps.projects.factories import ProjectFactory, TimeLogFactory
from apps.proposals.factories import ProposalFactory


@pytest.mark.django_db
def test_revenue_endpoint_requires_authentication():
    client = APIClient()

    response = client.get(reverse("analytics-revenue"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_revenue_endpoint_is_organisation_scoped(authenticated_client, org):
    own_client = ClientFactory(organisation=org)
    own_invoice = InvoiceFactory(
        organisation=org,
        client=own_client,
        total=Decimal("900.00"),
        subtotal=Decimal("900.00"),
    )
    PaymentFactory(invoice=own_invoice, amount=Decimal("300.00"))

    other_org = OrganisationFactory()
    other_client = ClientFactory(organisation=other_org)
    other_invoice = InvoiceFactory(
        organisation=other_org,
        client=other_client,
        total=Decimal("2000.00"),
        subtotal=Decimal("2000.00"),
    )
    PaymentFactory(invoice=other_invoice, amount=Decimal("1800.00"))

    response = authenticated_client.get(reverse("analytics-revenue"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["total_collected"] == "300.00"


@pytest.mark.django_db
def test_insights_endpoint_returns_empty_list_when_no_rules_fire(authenticated_client):
    response = authenticated_client.get(reverse("analytics-insights"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data == []


@pytest.mark.django_db
def test_assistant_query_endpoint_returns_structured_email_draft(
    authenticated_client,
    org,
):
    proposal = ProposalFactory(
        organisation=org,
        status="sent",
        deadline=timezone.localdate() + timedelta(days=2),
        title="School ERP Rollout",
    )

    response = authenticated_client.post(
        reverse("assistant-query"),
        {
            "message": "draft a follow up email for this proposal",
            "context": {"proposal_id": str(proposal.id)},
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["matched_rule"] == "draft_proposal_follow_up_email"
    assert response.data["draft"]["template_key"] == "proposal_follow_up_deadline_near"
    assert "subject" in response.data["draft"]
    assert "body" in response.data["draft"]


@pytest.mark.django_db
def test_assistant_query_endpoint_can_return_follow_up_recommendations(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org, name="Tema SHS")
    invoice = InvoiceFactory(
        organisation=org,
        client=client,
        status="sent",
        due_date=timezone.localdate() - timedelta(days=4),
        total=Decimal("600.00"),
        subtotal=Decimal("600.00"),
    )
    PaymentFactory(invoice=invoice, amount=Decimal("100.00"))

    response = authenticated_client.post(
        reverse("assistant-query"),
        {"message": "who should I follow up today?"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["matched_rule"] == "get_follow_up_recommendations"
    assert "Tema SHS" in response.data["reply"]
    assert "500.00" in response.data["reply"]
    assert response.data["items"][0]["type"] == "invoice_follow_up"


@pytest.mark.django_db
def test_assistant_query_endpoint_can_draft_stale_project_email(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org, name="Labone Academy")
    project = ProjectFactory(
        organisation=org,
        client=client,
        status="active",
        title="Parent Portal",
        start_date=timezone.localdate() - timedelta(days=25),
    )
    TimeLogFactory(
        project=project,
        log_date=timezone.localdate() - timedelta(days=15),
    )

    response = authenticated_client.post(
        reverse("assistant-query"),
        {"message": "Let's draft an email to stale projects"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["matched_rule"] == "draft_stale_project_follow_up_email"
    assert response.data["draft"]["template_key"] == "project_stale_follow_up"
    assert "Parent Portal" in response.data["draft"]["subject"]
    assert response.data["items"][0]["type"] == "stale_project_follow_up"


@pytest.mark.django_db
def test_assistant_briefing_endpoint_returns_structured_briefing(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org, name="Takoradi Technical Institute")
    invoice = InvoiceFactory(
        organisation=org,
        client=client,
        status="sent",
        due_date=timezone.localdate() - timedelta(days=3),
        total=Decimal("850.00"),
        subtotal=Decimal("850.00"),
    )
    PaymentFactory(invoice=invoice, amount=Decimal("200.00"))

    response = authenticated_client.get(reverse("assistant-briefing"))

    assert response.status_code == status.HTTP_200_OK
    assert "headline" in response.data
    assert "revenue_summary" in response.data
    assert "follow_up" in response.data
    assert "insights" in response.data
    assert response.data["follow_up"]["matched_rule"] == "get_follow_up_recommendations"
