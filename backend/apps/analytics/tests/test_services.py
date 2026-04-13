from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.analytics import insights, services
from apps.clients.factories import ClientFactory
from apps.invoices.factories import InvoiceFactory, PaymentFactory
from apps.projects.factories import ProjectFactory, TimeLogFactory
from apps.proposals.factories import ProposalFactory
from apps.proposals.models import Proposal


@pytest.mark.django_db
def test_get_revenue_series_returns_zero_filled_months(org):
    client = ClientFactory(organisation=org)
    invoice = InvoiceFactory(
        organisation=org,
        client=client,
        total=Decimal("750.00"),
        subtotal=Decimal("750.00"),
    )
    PaymentFactory(invoice=invoice, amount=Decimal("500.00"))

    payload = services.get_revenue_series(organisation=org, months=4)

    assert len(payload["months"]) == 4
    assert payload["months"][-1]["collected_ghs"] == "500.00"
    assert payload["total_collected"] == "500.00"
    assert any(row["collected_ghs"] == "0.00" for row in payload["months"][:-1])


@pytest.mark.django_db
def test_get_pipeline_metrics_uses_decided_proposals_only_for_win_rate(org):
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.WON,
        sent_date=timezone.localdate() - timedelta(days=10),
        decision_date=timezone.localdate() - timedelta(days=2),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.LOST,
        sent_date=timezone.localdate() - timedelta(days=9),
        decision_date=timezone.localdate() - timedelta(days=1),
    )
    ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.SENT,
        sent_date=timezone.localdate() - timedelta(days=3),
    )

    payload = services.get_pipeline_metrics(organisation=org)

    assert payload["win_rate_pct"] == 50.0
    sent_row = next(row for row in payload["by_status"] if row["status"] == "sent")
    assert sent_row["count"] == 1


@pytest.mark.django_db
def test_build_insights_returns_only_triggered_rules(org):
    client = ClientFactory(organisation=org, name="GIS International")
    project = ProjectFactory(
        organisation=org,
        client=client,
        status="active",
        budget=Decimal("5000.00"),
    )
    TimeLogFactory(project=project, hours=Decimal("10.00"), is_billable=True)
    InvoiceFactory(
        organisation=org,
        client=client,
        project=project,
        total=Decimal("1000.00"),
        subtotal=Decimal("1000.00"),
        status="sent",
    )

    result = insights.build_insights(organisation=org)

    assert result
    assert {item["type"] for item in result} == {"low_effective_rate"}


@pytest.mark.django_db
def test_draft_proposal_follow_up_email_uses_expected_template(org):
    proposal = ProposalFactory(
        organisation=org,
        status=Proposal.ProposalStatus.NEGOTIATING,
        title="Student Portal Upgrade",
    )

    draft = services.draft_proposal_follow_up_email(
        organisation=org,
        proposal_id=str(proposal.id),
    )

    assert draft["template_key"] == "proposal_follow_up_negotiating"
    assert proposal.client.name in draft["body"]
    assert proposal.title in draft["subject"]


@pytest.mark.django_db
def test_resolve_assistant_query_returns_explicit_unsupported_response(org):
    payload = services.resolve_assistant_query(
        organisation=org,
        data={"message": "write me a poem about software"},
    )

    assert payload["matched_rule"] == "unsupported_request"
    assert "supported Sprint 3 requests" in payload["reply"]


@pytest.mark.django_db
def test_resolve_assistant_query_drafts_stale_project_email(org):
    client = ClientFactory(organisation=org, name="North Ridge Academy")
    project = ProjectFactory(
        organisation=org,
        client=client,
        status="active",
        title="Admissions Portal",
        start_date=timezone.localdate() - timedelta(days=30),
        due_date=timezone.localdate() + timedelta(days=10),
    )
    TimeLogFactory(
        project=project,
        log_date=timezone.localdate() - timedelta(days=18),
    )

    payload = services.resolve_assistant_query(
        organisation=org,
        data={"message": "Let's draft an email to stale projects"},
    )

    assert payload["matched_rule"] == "draft_stale_project_follow_up_email"
    assert payload["draft"]["template_key"] == "project_stale_follow_up"
    assert "Admissions Portal" in payload["draft"]["subject"]
    assert "North Ridge Academy" in payload["draft"]["body"]
    assert payload["items"][0]["type"] == "stale_project_follow_up"


@pytest.mark.django_db
def test_summarize_client_health_aggregates_finance_and_delivery_signals(org):
    client = ClientFactory(organisation=org, name="Accra Academy")
    ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
    )
    project = ProjectFactory(organisation=org, client=client, status="active")
    invoice = InvoiceFactory(
        organisation=org,
        client=client,
        project=project,
        total=Decimal("1200.00"),
        subtotal=Decimal("1200.00"),
        status="sent",
    )
    PaymentFactory(invoice=invoice, amount=Decimal("400.00"))
    TimeLogFactory(project=project, hours=Decimal("3.00"), is_billable=True)

    payload = services.summarize_client_health(
        organisation=org,
        client_id=str(client.id),
    )

    assert payload["matched_rule"] == "summarize_client_health"
    assert "Accra Academy" in payload["reply"]
    assert "1200.00" in payload["reply"]
    assert "400.00" in payload["reply"]
    assert "800.00" in payload["reply"]


@pytest.mark.django_db
def test_get_follow_up_recommendations_ranks_urgent_items_first(org):
    client = ClientFactory(organisation=org, name="Ridge School")
    overdue_invoice = InvoiceFactory(
        organisation=org,
        client=client,
        status="sent",
        due_date=timezone.localdate() - timedelta(days=7),
        total=Decimal("900.00"),
        subtotal=Decimal("900.00"),
    )
    ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
        deadline=timezone.localdate() + timedelta(days=1),
        sent_date=timezone.localdate() - timedelta(days=5),
    )

    payload = services.get_follow_up_recommendations(organisation=org)
    first_line = payload["reply"].splitlines()[0]

    assert payload["matched_rule"] == "get_follow_up_recommendations"
    assert "Ridge School" in first_line
    assert "900.00" in first_line
    assert overdue_invoice.client.name in payload["reply"]
    assert payload["items"]
    assert payload["items"][0]["type"] == "invoice_follow_up"


@pytest.mark.django_db
def test_build_daily_briefing_returns_headline_follow_up_and_insights(org):
    client = ClientFactory(organisation=org, name="Cape Coast SHS")
    invoice = InvoiceFactory(
        organisation=org,
        client=client,
        status="sent",
        due_date=timezone.localdate() - timedelta(days=2),
        total=Decimal("700.00"),
        subtotal=Decimal("700.00"),
    )
    PaymentFactory(invoice=invoice, amount=Decimal("100.00"))

    payload = services.build_daily_briefing(organisation=org)

    assert "headline" in payload
    assert "revenue_summary" in payload
    assert "follow_up" in payload
    assert "insights" in payload
    assert payload["follow_up"]["items"]


@pytest.mark.django_db
def test_build_ai_context_contains_expected_sections(org):
    client = ClientFactory(organisation=org, name="Achimota Learning Hub")
    proposal = ProposalFactory(
        organisation=org,
        client=client,
        status=Proposal.ProposalStatus.SENT,
        title="Campus ERP Modernization",
        amount=Decimal("2100.00"),
        deadline=timezone.localdate() + timedelta(days=6),
    )
    project = ProjectFactory(
        organisation=org,
        client=client,
        title="ERP Delivery",
        status="active",
        budget=Decimal("6000.00"),
    )
    invoice = InvoiceFactory(
        organisation=org,
        client=client,
        project=project,
        status="sent",
        total=Decimal("1800.00"),
        subtotal=Decimal("1800.00"),
        due_date=timezone.localdate() - timedelta(days=3),
    )
    PaymentFactory(invoice=invoice, amount=Decimal("900.00"))
    TimeLogFactory(project=project, hours=Decimal("4.00"), is_billable=True)

    context = services.build_ai_context(organisation=org)

    assert org.name in context
    assert "Revenue this month:" in context
    assert "Top clients:" in context
    assert "Open proposals:" in context
    assert proposal.title in context
    assert "Overdue invoices:" in context
    assert client.name in context
    assert "Active projects:" in context
    assert "ERP Delivery" in context


@pytest.mark.django_db
def test_build_ai_context_is_capped_to_8000_chars(org, monkeypatch):
    long_client_name = "X" * 9000

    def fake_profitability(*, organisation, sort_by):
        return [
            {
                "client_id": org.id,
                "client_name": long_client_name,
                "invoiced_ghs": "1000.00",
                "collected_ghs": "500.00",
                "outstanding_ghs": "500.00",
                "total_hours": 1.0,
                "billable_hours": 1.0,
                "effective_rate_ghs": "1000.00",
                "open_proposals": 1,
            }
        ]

    monkeypatch.setattr(services, "get_client_profitability", fake_profitability)

    context = services.build_ai_context(organisation=org)

    assert len(context) == 8000
