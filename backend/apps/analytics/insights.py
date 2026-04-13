"""
Rule-based insight functions for Sprint 3.

Each insight is deterministic:
- it reads organisation-scoped metrics
- it returns one insight dict or `None`
- it never guesses when the dataset is too small to support the claim
"""

from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.accounts.models import Organisation
from apps.analytics import services
from apps.invoices.models import Invoice
from apps.projects.models import Project
from apps.proposals.models import Proposal


def build_insights(*, organisation: Organisation) -> list[dict]:
    """
    Build the full flat list of active insights for one organisation.

    Each helper returns one insight dict or `None`; this function filters out
    the inactive rules and returns only live observations.
    """

    candidates = [
        get_overdue_concentration_insight(organisation=organisation),
        get_low_effective_rate_insight(organisation=organisation),
        get_declining_collection_trend_insight(organisation=organisation),
        get_pipeline_stall_insight(organisation=organisation),
        get_budget_burn_risk_insight(organisation=organisation),
    ]
    return [insight for insight in candidates if insight is not None]


def get_low_effective_rate_insight(*, organisation: Organisation) -> dict | None:
    """
    Flag the weakest client effective rate below the configured floor.
    """

    rows = services.get_client_profitability(organisation=organisation, sort_by="rate")
    if not rows:
        return None

    weakest = min(rows, key=lambda row: Decimal(row["effective_rate_ghs"]))
    rate = Decimal(weakest["effective_rate_ghs"])
    if rate >= services.LOW_EFFECTIVE_RATE_FLOOR:
        return None

    return {
        "type": "low_effective_rate",
        "severity": "medium",
        "title": "Low effective rate client",
        "body": (
            f"{weakest['client_name']} is currently yielding GHS {weakest['effective_rate_ghs']}/h, "
            f"below the GHS {services._money_str(services.LOW_EFFECTIVE_RATE_FLOOR)} floor."
        ),
        "entity_type": "Client",
        "entity_id": weakest["client_id"],
        "value": weakest["effective_rate_ghs"],
    }


def get_overdue_concentration_insight(*, organisation: Organisation) -> dict | None:
    """
    Flag when one client holds most of the overdue receivable risk.
    """

    today = timezone.localdate()
    invoices = (
        services._invoice_queryset(organisation=organisation)
        .exclude(status=Invoice.InvoiceStatus.PAID)
        .filter(due_date__lt=today)
    )
    buckets: dict[str, dict] = {}
    total_overdue = Decimal("0.00")
    for invoice in invoices:
        outstanding = services._invoice_outstanding_amount(invoice)
        total_overdue += outstanding
        key = str(invoice.client_id)
        if key not in buckets:
            buckets[key] = {
                "client_id": invoice.client_id,
                "client_name": invoice.client.name,
                "amount": Decimal("0.00"),
            }
        buckets[key]["amount"] += outstanding

    if total_overdue <= Decimal("0.00") or not buckets:
        return None

    largest = max(buckets.values(), key=lambda item: item["amount"])
    concentration_pct = (largest["amount"] / total_overdue) * Decimal("100")
    if concentration_pct <= Decimal("50"):
        return None

    return {
        "type": "overdue_concentration",
        "severity": "high",
        "title": "Overdue concentration",
        "body": (
            f"{largest['client_name']} accounts for {concentration_pct.quantize(Decimal('0.01'))}% "
            f"of overdue receivables."
        ),
        "entity_type": "Client",
        "entity_id": largest["client_id"],
        "value": services._money_str(largest["amount"]),
    }


def get_pipeline_stall_insight(*, organisation: Organisation) -> dict | None:
    """
    Flag proposals aging beyond twice the normal close time.
    """

    proposals = list(services._proposal_queryset(organisation=organisation))
    decided = [
        proposal
        for proposal in proposals
        if proposal.status
        in {Proposal.ProposalStatus.WON, Proposal.ProposalStatus.LOST}
        and proposal.sent_date
        and proposal.decision_date
    ]
    if len(decided) < 3:
        return None

    average_days = sum(
        (proposal.decision_date - proposal.sent_date).days for proposal in decided
    ) / len(decided)
    threshold = average_days * 2
    today = timezone.localdate()
    stalled = [
        proposal
        for proposal in proposals
        if proposal.status
        in {Proposal.ProposalStatus.SENT, Proposal.ProposalStatus.NEGOTIATING}
        and proposal.sent_date
        and (today - proposal.sent_date).days > threshold
    ]
    if not stalled:
        return None

    stalled.sort(key=lambda proposal: (today - proposal.sent_date).days, reverse=True)
    top = stalled[0]
    return {
        "type": "pipeline_stall",
        "severity": "medium",
        "title": "Pipeline stall",
        "body": (
            f"{len(stalled)} proposal(s) have been open longer than 2x your typical close cycle. "
            f"{top.title} for {top.client.name} is the stalest."
        ),
        "entity_type": "Proposal",
        "entity_id": top.id,
        "value": str(len(stalled)),
    }


def get_budget_burn_risk_insight(*, organisation: Organisation) -> dict | None:
    """
    Flag the most urgent active project whose budget burn is above 80%.
    """

    rows = [
        row
        for row in services.get_project_budget_burn(organisation=organisation)
        if row["status"] != Project.ProjectStatus.DONE
        and Decimal(str(row["burn_pct"])) > Decimal("80")
    ]
    if not rows:
        return None

    riskiest = max(rows, key=lambda row: Decimal(str(row["burn_pct"])))
    return {
        "type": "budget_burn_warning",
        "severity": "high",
        "title": "Budget burn warning",
        "body": (
            f"{riskiest['title']} is at {riskiest['burn_pct']:.2f}% burn "
            f"against a budget of GHS {riskiest['budget_ghs']}."
        ),
        "entity_type": "Project",
        "entity_id": riskiest["project_id"],
        "value": f"{riskiest['burn_pct']:.2f}",
    }


def get_declining_collection_trend_insight(
    *, organisation: Organisation
) -> dict | None:
    """
    Flag a meaningful movement in this month's collections versus recent average.
    """

    series = services.get_revenue_series(organisation=organisation, months=4)["months"]
    if len(series) < 4:
        return None

    current = Decimal(series[-1]["collected_ghs"])
    previous_values = [Decimal(row["collected_ghs"]) for row in series[:-1]]
    if len(previous_values) < 3:
        return None
    previous_avg = sum(previous_values, Decimal("0.00")) / Decimal(len(previous_values))
    if previous_avg == Decimal("0.00"):
        return None

    change_pct = ((current - previous_avg) / previous_avg) * Decimal("100")
    if abs(change_pct) <= Decimal("20"):
        return None

    direction = "up" if change_pct > 0 else "down"
    severity = "info" if change_pct > 0 else "medium"
    return {
        "type": "revenue_trend",
        "severity": severity,
        "title": "Revenue trend",
        "body": (
            f"This month's collections are {direction} "
            f"{change_pct.quantize(Decimal('0.01'))}% versus the previous 3-month average."
        ),
        "value": f"{change_pct.quantize(Decimal('0.01'))}",
    }
