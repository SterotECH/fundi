"""
Business logic for Sprint 3 analytics.

This module owns two related responsibilities:
- deterministic analytics aggregates over Sprint 1 and 2 data
- a narrow rule-based assistant router that answers supported business requests

Every query is organisation-scoped. Views stay thin and delegate here.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from django.db.models import Prefetch
from django.utils import timezone

from apps.accounts.models import Organisation
from apps.analytics.templates import select_assistant_reply, select_template_variant
from apps.clients.models import Client
from apps.invoices.models import Invoice, Payment
from apps.projects.models import Project, TimeLog
from apps.proposals.models import Proposal

ZERO_MONEY = Decimal("0.00")
MONEY_QUANT = Decimal("0.01")
LOW_EFFECTIVE_RATE_FLOOR = Decimal("250.00")


def _to_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _money_str(value: Decimal) -> str:
    return f"{_to_money(value):.2f}"


def _sum_money(values: list[Decimal]) -> Decimal:
    return _to_money(sum(values, ZERO_MONEY))


def _sum_invoice_payments(invoice: Invoice) -> Decimal:
    return _sum_money([payment.amount for payment in invoice.payments.all()])


def _invoice_outstanding_amount(invoice: Invoice) -> Decimal:
    remaining = invoice.total - _sum_invoice_payments(invoice)
    if remaining < ZERO_MONEY:
        return ZERO_MONEY
    return _to_money(remaining)


def _month_start(value: date) -> date:
    return value.replace(day=1)


def _subtract_months(value: date, months: int) -> date:
    year = value.year
    month = value.month - months
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


def _month_key(value: date) -> str:
    return value.strftime("%Y-%m")


def _coerce_uuid(value: str | UUID) -> str:
    return str(value)


def _proposal_queryset(*, organisation: Organisation):
    return Proposal.objects.select_related("organisation", "client").filter(
        organisation=organisation
    )


def _invoice_queryset(*, organisation: Organisation):
    return (
        Invoice.objects.select_related("organisation", "client", "project")
        .prefetch_related("payments")
        .filter(organisation=organisation)
    )


def _project_queryset(*, organisation: Organisation):
    return (
        Project.objects.select_related("organisation", "client", "proposal")
        .prefetch_related(
            "invoices__payments",
            Prefetch(
                "time_logs",
                queryset=TimeLog.objects.select_related("user").order_by(
                    "log_date",
                    "created_at",
                ),
            ),
        )
        .filter(organisation=organisation)
    )


def _client_queryset(*, organisation: Organisation):
    return (
        Client.objects.filter(organisation=organisation, is_archived=False)
        .prefetch_related(
            Prefetch(
                "invoices",
                queryset=Invoice.objects.select_related("project").prefetch_related(
                    "payments"
                ),
            ),
            "proposals",
            Prefetch(
                "projects",
                queryset=Project.objects.select_related("proposal").prefetch_related(
                    Prefetch(
                        "time_logs",
                        queryset=TimeLog.objects.select_related("user").order_by(
                            "log_date",
                            "created_at",
                        ),
                    )
                ),
            ),
        )
        .order_by("name", "-created_at")
    )


def resolve_assistant_query(
    *, organisation: Organisation, data: dict[str, Any]
) -> dict:
    """
    Route one assistant request to a supported deterministic rule family.

    Unsupported requests are rejected explicitly so the assistant never pretends
    to handle open-ended chat.
    """

    message = str(data.get("message", "")).strip()
    normalized = message.lower()
    context = data.get("context") or {}

    proposal_id = context.get("proposal_id")
    invoice_id = context.get("invoice_id")
    client_id = context.get("client_id")
    project_id = context.get("project_id")

    if any(
        phrase in normalized
        for phrase in {
            "draft an email to stale projects",
            "draft email to stale projects",
            "email stale projects",
            "stale project email",
            "stale projects",
        }
    ):
        return draft_stale_project_follow_up_email(
            organisation=organisation,
            project_id=_coerce_uuid(project_id) if project_id else None,
        )

    if any(
        phrase in normalized
        for phrase in {
            "who should i follow up",
            "follow up today",
            "follow-up today",
            "what needs attention",
            "needs attention first",
        }
    ):
        return get_follow_up_recommendations(organisation=organisation)

    if proposal_id and any(
        phrase in normalized for phrase in {"draft", "email", "follow up", "follow-up"}
    ):
        return {
            "reply": "I drafted a proposal follow-up email from the current proposal facts.",
            "matched_rule": "draft_proposal_follow_up_email",
            "data_context_used": "Proposal status, deadline, amount, and client details.",
            "draft": draft_proposal_follow_up_email(
                organisation=organisation,
                proposal_id=_coerce_uuid(proposal_id),
            ),
        }

    if invoice_id and any(
        phrase in normalized
        for phrase in {"draft", "email", "reminder", "payment reminder"}
    ):
        return {
            "reply": "I drafted an overdue invoice reminder using the current invoice balance and overdue duration.",
            "matched_rule": "draft_overdue_invoice_email",
            "data_context_used": "Invoice amount, outstanding balance, overdue duration, and client details.",
            "draft": draft_overdue_invoice_email(
                organisation=organisation,
                invoice_id=_coerce_uuid(invoice_id),
            ),
        }

    if invoice_id and any(
        phrase in normalized
        for phrase in {"overdue", "balance", "payment chase", "call this client"}
    ):
        return summarize_overdue_balance(
            organisation=organisation,
            invoice_id=_coerce_uuid(invoice_id),
        )

    if proposal_id and any(
        phrase in normalized
        for phrase in {"proposal", "deadline", "status", "summarise", "summarize"}
    ):
        return summarize_proposal(
            organisation=organisation,
            proposal_id=_coerce_uuid(proposal_id),
        )

    if client_id and any(
        phrase in normalized
        for phrase in {"client", "account", "health", "summarise", "summarize"}
    ):
        return summarize_client_health(
            organisation=organisation,
            client_id=_coerce_uuid(client_id),
        )

    if project_id and any(
        phrase in normalized for phrase in {"project", "budget", "risk", "healthy"}
    ):
        return summarize_project_risk(
            organisation=organisation,
            project_id=_coerce_uuid(project_id),
        )

    if any(
        phrase in normalized
        for phrase in {
            "revenue",
            "collected",
            "collect",
            "outstanding",
            "overdue invoices",
        }
    ):
        return summarize_revenue_position(organisation=organisation)

    return {
        "reply": (
            "I can only help with supported Sprint 3 requests: revenue summaries, "
            "overdue balance summaries, proposal summaries, client health, project risk, "
            "follow-up recommendations, and deterministic email drafts for proposals, "
            "overdue invoices, and stale projects."
        ),
        "matched_rule": "unsupported_request",
        "data_context_used": "No supported rule matched the current request.",
    }


def draft_proposal_follow_up_email(
    *,
    organisation: Organisation,
    proposal_id: str,
) -> dict:
    """
    Build a deterministic follow-up email draft for one proposal.
    """

    proposal = _proposal_queryset(organisation=organisation).get(id=proposal_id)
    today = timezone.localdate()
    days_to_deadline = (proposal.deadline - today).days

    if proposal.status == Proposal.ProposalStatus.NEGOTIATING:
        template_family = "proposal_follow_up_negotiating"
    elif days_to_deadline <= 3:
        template_family = "proposal_follow_up_deadline_near"
    else:
        template_family = "proposal_follow_up_general"

    template_key, template = select_template_variant(
        family=template_family,
        seed=str(proposal.id),
    )
    context = {
        "client_name": proposal.client.name,
        "contact_name": proposal.client.contact_person or "there",
        "proposal_title": proposal.title,
        "proposal_amount": _money_str(proposal.amount),
        "deadline": proposal.deadline.strftime("%d %b %Y"),
        "days_to_deadline": max(days_to_deadline, 0),
    }
    return {
        "subject": template["subject"].format(**context),
        "body": template["body"].format(**context),
        "template_key": template_key,
    }


def draft_overdue_invoice_email(
    *,
    organisation: Organisation,
    invoice_id: str,
) -> dict:
    """
    Build a deterministic overdue-invoice reminder email.
    """

    invoice = _invoice_queryset(organisation=organisation).get(id=invoice_id)
    today = timezone.localdate()
    overdue_days = max((today - invoice.due_date).days, 0) if invoice.due_date else 0
    outstanding_amount = _invoice_outstanding_amount(invoice)
    template_family = (
        "invoice_overdue_firm" if overdue_days > 14 else "invoice_overdue_gentle"
    )

    label = invoice.invoice_number or f"invoice dated {invoice.issue_date:%d %b %Y}"
    context = {
        "client_name": invoice.client.name,
        "contact_name": invoice.client.contact_person or "there",
        "invoice_label": label,
        "outstanding_amount": _money_str(outstanding_amount),
        "overdue_days": overdue_days,
        "due_date": invoice.due_date.strftime("%d %b %Y")
        if invoice.due_date
        else "N/A",
    }
    template_key, template = select_template_variant(
        family=template_family,
        seed=str(invoice.id),
    )
    return {
        "subject": template["subject"].format(**context),
        "body": template["body"].format(**context),
        "template_key": template_key,
    }


def _get_project_inactive_days(project: Project, today: date) -> int:
    latest_log_date = None
    for time_log in project.time_logs.all():
        if latest_log_date is None or time_log.log_date > latest_log_date:
            latest_log_date = time_log.log_date

    anchor_date = latest_log_date or project.start_date
    return max((today - anchor_date).days, 0)


def _get_stale_project_candidates(
    *, organisation: Organisation
) -> list[dict[str, Any]]:
    today = timezone.localdate()
    candidates: list[dict[str, Any]] = []
    projects = (
        _project_queryset(organisation=organisation)
        .filter(
            status__in=[
                Project.ProjectStatus.PLANNING,
                Project.ProjectStatus.ACTIVE,
                Project.ProjectStatus.HOLD,
            ]
        )
        .order_by("due_date", "-created_at")
    )

    for project in projects:
        inactive_days = _get_project_inactive_days(project, today)
        days_past_due = max((today - project.due_date).days, 0)
        if inactive_days < 14 and days_past_due == 0:
            continue

        candidates.append(
            {
                "project": project,
                "inactive_days": inactive_days,
                "days_past_due": days_past_due,
                "priority": inactive_days + (days_past_due * 2),
            }
        )

    candidates.sort(key=lambda item: item["priority"], reverse=True)
    return candidates


def draft_stale_project_follow_up_email(
    *,
    organisation: Organisation,
    project_id: str | None = None,
) -> dict:
    """
    Build a deterministic follow-up email for a stale project.

    A project is considered stale when it is still open and either has no recent
    time logs for 14+ days or is already past its due date.
    """

    today = timezone.localdate()
    if project_id:
        project = _project_queryset(organisation=organisation).get(id=project_id)
        inactive_days = _get_project_inactive_days(project, today)
        candidates = [
            {
                "project": project,
                "inactive_days": inactive_days,
                "days_past_due": max((today - project.due_date).days, 0),
                "priority": inactive_days,
            }
        ]
    else:
        candidates = _get_stale_project_candidates(organisation=organisation)

    if not candidates:
        return {
            "reply": "I did not find any stale open projects that need a follow-up email right now.",
            "matched_rule": "draft_stale_project_follow_up_email",
            "data_context_used": "Open projects, due dates, and latest time log dates.",
            "items": [],
        }

    selected = candidates[0]
    project = selected["project"]
    template_key, template = select_template_variant(
        family="project_stale_follow_up",
        seed=str(project.id),
    )
    context = {
        "client_name": project.client.name,
        "contact_name": project.client.contact_person or "there",
        "project_title": project.title,
        "inactive_days": selected["inactive_days"],
        "due_date": project.due_date.strftime("%d %b %Y"),
        "status": project.get_status_display().lower(),
        "budget": _money_str(project.budget),
    }
    draft = {
        "subject": template["subject"].format(**context),
        "body": template["body"].format(**context),
        "template_key": template_key,
    }
    items = [
        {
            "type": "stale_project_follow_up",
            "label": f"Follow up on {candidate['project'].title}",
            "reason": (
                f"For {candidate['project'].client.name}; inactive for "
                f"{candidate['inactive_days']} day(s)."
            ),
            "entity_type": "Project",
            "entity_id": candidate["project"].id,
            "priority": candidate["priority"],
        }
        for candidate in candidates[:5]
    ]

    return {
        "reply": (
            f"I drafted a stale-project follow-up email for {project.title}. "
            f"I selected it because it has been inactive for {selected['inactive_days']} day(s)."
        ),
        "matched_rule": "draft_stale_project_follow_up_email",
        "data_context_used": "Open projects, due dates, latest time log dates, budget, and client details.",
        "draft": draft,
        "items": items,
    }


def summarize_overdue_balance(*, organisation: Organisation, invoice_id: str) -> dict:
    """
    Return a short balance summary for an overdue invoice.
    """

    invoice = _invoice_queryset(organisation=organisation).get(id=invoice_id)
    today = timezone.localdate()
    paid_amount = _sum_invoice_payments(invoice)
    outstanding_amount = _invoice_outstanding_amount(invoice)
    overdue_days = max((today - invoice.due_date).days, 0) if invoice.due_date else 0
    label = invoice.invoice_number or f"invoice dated {invoice.issue_date:%d %b %Y}"

    reply = select_assistant_reply(
        family="overdue_balance",
        seed=str(invoice.id),
        context={
            "client_name": invoice.client.name,
            "invoice_label": label,
            "outstanding_amount": _money_str(outstanding_amount),
            "paid_amount": _money_str(paid_amount),
            "invoice_total": _money_str(invoice.total),
            "overdue_days": overdue_days,
        },
    )

    return {
        "reply": reply,
        "matched_rule": "summarize_overdue_balance",
        "data_context_used": "Invoice total, recorded payments, due date, and client details.",
    }


def summarize_revenue_position(*, organisation: Organisation) -> dict:
    """
    Return a concise revenue summary for one organisation.

    The response is assistant-ready: a human-readable reply string plus the
    rule metadata used by the assistant endpoint.
    """

    summary = get_revenue_summary(organisation=organisation)
    reply = select_assistant_reply(
        family="revenue_summary",
        seed=f"{organisation.id}:{timezone.localdate():%Y-%m}",
        context=summary,
    )

    return {
        "reply": reply,
        "matched_rule": "summarize_revenue_position",
        "data_context_used": "Current month collections, outstanding receivables, and overdue totals.",
    }


def summarize_proposal(*, organisation: Organisation, proposal_id: str) -> dict:
    """
    Return a short proposal briefing.
    """

    proposal = _proposal_queryset(organisation=organisation).get(id=proposal_id)
    today = timezone.localdate()
    age_days = (today - proposal.sent_date).days if proposal.sent_date else None
    days_to_deadline = (proposal.deadline - today).days
    age_fragment = (
        f" It has been open for {age_days} day(s)." if age_days is not None else ""
    )
    deadline_fragment = (
        f" Deadline is in {days_to_deadline} day(s)."
        if days_to_deadline >= 0
        else f" Deadline passed {-days_to_deadline} day(s) ago."
    )

    reply = select_assistant_reply(
        family="proposal_summary",
        seed=str(proposal.id),
        context={
            "proposal_title": proposal.title,
            "client_name": proposal.client.name,
            "status": proposal.get_status_display().lower(),
            "proposal_amount": _money_str(proposal.amount),
            "age_fragment": age_fragment,
            "deadline_fragment": deadline_fragment,
        },
    )

    return {
        "reply": reply,
        "matched_rule": "summarize_proposal",
        "data_context_used": "Proposal status, sent date, deadline, amount, and client details.",
    }


def summarize_client_health(*, organisation: Organisation, client_id: str) -> dict:
    """
    Return a one-client health snapshot.
    """

    rows = get_client_profitability(organisation=organisation, sort_by="revenue")
    row = next(item for item in rows if str(item["client_id"]) == client_id)
    client = _client_queryset(organisation=organisation).get(id=client_id)
    active_projects = sum(
        1
        for project in client.projects.all()
        if project.status
        in {
            Project.ProjectStatus.PLANNING,
            Project.ProjectStatus.ACTIVE,
            Project.ProjectStatus.HOLD,
        }
    )

    reply = select_assistant_reply(
        family="client_health",
        seed=str(client.id),
        context={
            "client_name": client.name,
            "invoiced_ghs": row["invoiced_ghs"],
            "collected_ghs": row["collected_ghs"],
            "outstanding_ghs": row["outstanding_ghs"],
            "open_proposals": row["open_proposals"],
            "active_projects": active_projects,
            "billable_hours": f"{row['billable_hours']:.2f}",
        },
    )

    return {
        "reply": reply,
        "matched_rule": "summarize_client_health",
        "data_context_used": "Client invoices, payments, open proposals, projects, and logged hours.",
    }


def summarize_project_risk(*, organisation: Organisation, project_id: str) -> dict:
    """
    Return a project budget-risk summary.
    """

    rows = get_project_budget_burn(organisation=organisation)
    row = next(item for item in rows if str(item["project_id"]) == project_id)

    burn_pct = Decimal(str(row["burn_pct"]))
    if row["status"] == Project.ProjectStatus.DONE:
        risk_label = "healthy"
    elif burn_pct >= Decimal("80"):
        risk_label = "critical"
    elif burn_pct >= Decimal("60"):
        risk_label = "warning"
    else:
        risk_label = "healthy"

    reply = select_assistant_reply(
        family="project_risk",
        seed=str(project_id),
        context={
            "title": row["title"],
            "client_name": row["client_name"],
            "risk_label": risk_label,
            "budget_ghs": row["budget_ghs"],
            "invoiced_ghs": row["invoiced_ghs"],
            "burn_pct": f"{row['burn_pct']:.2f}",
            "billable_hours": f"{row['billable_hours']:.2f}",
        },
    )

    return {
        "reply": reply,
        "matched_rule": "summarize_project_risk",
        "data_context_used": "Project budget, invoice totals, billable hours, and project status.",
    }


def get_follow_up_recommendations(*, organisation: Organisation) -> dict:
    """
    Return today's priority follow-up list.
    """

    today = timezone.localdate()
    recommendations: list[dict[str, Any]] = []

    overdue_invoices = (
        _invoice_queryset(organisation=organisation)
        .exclude(status=Invoice.InvoiceStatus.PAID)
        .filter(due_date__lt=today)
        .order_by("due_date", "-created_at")
    )
    for invoice in overdue_invoices:
        overdue_days = (today - invoice.due_date).days if invoice.due_date else 0
        recommendations.append(
            {
                "type": "invoice_follow_up",
                "label": f"Follow up on {invoice.client.name}",
                "reason": (
                    f"Owes GHS {_money_str(_invoice_outstanding_amount(invoice))} "
                    f"and is {overdue_days} day(s) overdue."
                ),
                "entity_type": "Invoice",
                "entity_id": invoice.id,
                "priority": 100 + overdue_days,
            }
        )

    due_soon_proposals = (
        _proposal_queryset(organisation=organisation)
        .filter(
            status__in=[
                Proposal.ProposalStatus.SENT,
                Proposal.ProposalStatus.NEGOTIATING,
            ],
            deadline__lte=today + timedelta(days=3),
            deadline__gte=today,
        )
        .order_by("deadline", "-created_at")
    )
    for proposal in due_soon_proposals:
        days_left = (proposal.deadline - today).days
        recommendations.append(
            {
                "type": "proposal_follow_up",
                "label": f"Check {proposal.title}",
                "reason": f"For {proposal.client.name}; deadline is in {days_left} day(s).",
                "entity_type": "Proposal",
                "entity_id": proposal.id,
                "priority": 80 - days_left,
            }
        )

    for row in get_project_budget_burn(organisation=organisation):
        if row["status"] == Project.ProjectStatus.DONE:
            continue
        if Decimal(str(row["burn_pct"])) >= Decimal("80"):
            recommendations.append(
                {
                    "type": "project_risk",
                    "label": f"Review {row['title']}",
                    "reason": (
                        f"Burn is {row['burn_pct']:.2f}% against a budget of "
                        f"GHS {row['budget_ghs']}."
                    ),
                    "entity_type": "Project",
                    "entity_id": row["project_id"],
                    "priority": 60,
                }
            )

    recommendations.sort(key=lambda item: item["priority"], reverse=True)
    top_items = recommendations[:5]
    lines = [f"{item['label']}: {item['reason']}" for item in top_items]

    if not lines:
        lines = [
            "No urgent follow-ups today. Your invoices, proposals, and projects look stable."
        ]

    return {
        "reply": "\n".join(f"- {line}" for line in lines),
        "matched_rule": "get_follow_up_recommendations",
        "data_context_used": "Overdue invoices, near-deadline proposals, and high-burn active projects.",
        "items": top_items,
    }


def build_daily_briefing(*, organisation: Organisation) -> dict:
    """
    Return a deterministic daily briefing for one organisation.

    The briefing is a higher-level wrapper around Sprint 3 analytics and
    recommendation services and is suitable for Celery-driven delivery later.
    """

    revenue_summary = get_revenue_summary(organisation=organisation)
    follow_up = get_follow_up_recommendations(organisation=organisation)
    from apps.analytics import insights

    insights_list = insights.build_insights(organisation=organisation)

    headline = (
        f"Today: GHS {revenue_summary['this_month_collected']} collected this month, "
        f"GHS {revenue_summary['total_outstanding']} outstanding, "
        f"{revenue_summary['overdue_count']} overdue invoice(s)."
    )

    return {
        "headline": headline,
        "revenue_summary": revenue_summary,
        "follow_up": follow_up,
        "insights": insights_list,
    }


def get_revenue_series(*, organisation: Organisation, months: int = 12) -> dict:
    """
    Return the zero-filled monthly revenue chart payload for one organisation.

    Payments are grouped by payment month and invoices by issue month. Missing
    months are normalised to zero rows so the frontend chart stays stable.
    """

    months = max(1, min(int(months), 24))
    today = timezone.localdate()
    current_month = _month_start(today)
    month_starts = [
        _subtract_months(current_month, months - 1 - index) for index in range(months)
    ]
    month_rows: dict[str, dict[str, Decimal | str]] = {
        _month_key(month_start): {
            "month": _month_key(month_start),
            "collected_ghs": ZERO_MONEY,
            "invoiced_ghs": ZERO_MONEY,
        }
        for month_start in month_starts
    }
    earliest_month = month_starts[0]

    payments = Payment.objects.select_related("invoice").filter(
        invoice__organisation=organisation,
        payment_date__gte=earliest_month,
    )
    for payment in payments:
        key = _month_key(_month_start(payment.payment_date))
        if key in month_rows:
            month_rows[key]["collected_ghs"] += payment.amount

    invoices = _invoice_queryset(organisation=organisation).filter(
        issue_date__gte=earliest_month,
    )
    for invoice in invoices:
        issue_date = invoice.issue_date or invoice.created_at.date()
        key = _month_key(_month_start(issue_date))
        if key in month_rows:
            month_rows[key]["invoiced_ghs"] += invoice.total

    month_list = []
    total_collected = ZERO_MONEY
    for month_start in month_starts:
        key = _month_key(month_start)
        row = month_rows[key]
        collected = _to_money(row["collected_ghs"])
        invoiced = _to_money(row["invoiced_ghs"])
        total_collected += collected
        month_list.append(
            {
                "month": key,
                "collected_ghs": _money_str(collected),
                "invoiced_ghs": _money_str(invoiced),
            }
        )

    summary = get_revenue_summary(organisation=organisation)
    return {
        "months": month_list,
        "total_collected": _money_str(total_collected),
        "total_outstanding": summary["total_outstanding"],
    }


def get_revenue_summary(*, organisation: Organisation) -> dict:
    """
    Return dashboard KPI revenue numbers.

    This includes this month, last month, year-to-date collections, plus live
    outstanding and overdue invoice totals.
    """

    today = timezone.localdate()
    this_month_start = today.replace(day=1)
    last_month_start = _subtract_months(this_month_start, 1)

    payments = Payment.objects.select_related("invoice").filter(
        invoice__organisation=organisation
    )
    this_month_collected = _sum_money(
        [
            payment.amount
            for payment in payments
            if payment.payment_date >= this_month_start
        ]
    )
    last_month_collected = _sum_money(
        [
            payment.amount
            for payment in payments
            if last_month_start <= payment.payment_date < this_month_start
        ]
    )
    ytd_collected = _sum_money(
        [
            payment.amount
            for payment in payments
            if payment.payment_date.year == today.year
        ]
    )

    if last_month_collected == ZERO_MONEY:
        mom_change_pct = 0.0 if this_month_collected == ZERO_MONEY else 100.0
    else:
        mom_change_pct = float(
            ((this_month_collected - last_month_collected) / last_month_collected) * 100
        )

    invoices = _invoice_queryset(organisation=organisation).exclude(
        status=Invoice.InvoiceStatus.PAID
    )
    total_outstanding = _sum_money(
        [_invoice_outstanding_amount(invoice) for invoice in invoices]
    )
    overdue_invoices = [
        invoice for invoice in invoices if invoice.due_date and invoice.due_date < today
    ]
    overdue_total = _sum_money(
        [_invoice_outstanding_amount(invoice) for invoice in overdue_invoices]
    )

    return {
        "this_month_collected": _money_str(this_month_collected),
        "last_month_collected": _money_str(last_month_collected),
        "mom_change_pct": round(mom_change_pct, 2),
        "ytd_collected": _money_str(ytd_collected),
        "total_outstanding": _money_str(total_outstanding),
        "overdue_count": len(overdue_invoices),
        "overdue_total": _money_str(overdue_total),
    }


def get_pipeline_metrics(*, organisation: Organisation) -> dict:
    """
    Return proposal funnel and conversion metrics.

    Win rate and average close time are calculated from decided proposals only.
    """

    proposals = list(_proposal_queryset(organisation=organisation))
    statuses = [
        Proposal.ProposalStatus.DRAFT,
        Proposal.ProposalStatus.SENT,
        Proposal.ProposalStatus.NEGOTIATING,
        Proposal.ProposalStatus.WON,
        Proposal.ProposalStatus.LOST,
    ]
    by_status: list[dict[str, Any]] = []
    for status in statuses:
        status_rows = [proposal for proposal in proposals if proposal.status == status]
        by_status.append(
            {
                "status": status,
                "count": len(status_rows),
                "total_value_ghs": _money_str(
                    _sum_money([proposal.amount for proposal in status_rows])
                ),
            }
        )

    decided = [
        proposal
        for proposal in proposals
        if proposal.status
        in {Proposal.ProposalStatus.WON, Proposal.ProposalStatus.LOST}
    ]
    won = [
        proposal
        for proposal in decided
        if proposal.status == Proposal.ProposalStatus.WON
    ]
    win_rate_pct = round((len(won) / len(decided) * 100), 2) if decided else 0.0
    avg_deal_value = (
        _sum_money([proposal.amount for proposal in won]) / len(won)
        if won
        else ZERO_MONEY
    )
    avg_deal_value = _to_money(avg_deal_value)

    close_durations = [
        (proposal.decision_date - proposal.sent_date).days
        for proposal in decided
        if proposal.decision_date and proposal.sent_date
    ]
    avg_days_to_close = (
        round(sum(close_durations) / len(close_durations), 2)
        if close_durations
        else 0.0
    )

    total_pipeline_value = _sum_money(
        [
            proposal.amount
            for proposal in proposals
            if proposal.status
            in {
                Proposal.ProposalStatus.DRAFT,
                Proposal.ProposalStatus.SENT,
                Proposal.ProposalStatus.NEGOTIATING,
            }
        ]
    )

    return {
        "by_status": by_status,
        "win_rate_pct": win_rate_pct,
        "avg_deal_value_ghs": _money_str(avg_deal_value),
        "avg_days_to_close": avg_days_to_close,
        "total_pipeline_value_ghs": _money_str(total_pipeline_value),
    }


def get_client_profitability(*, organisation: Organisation, sort_by: str) -> list[dict]:
    """
    Return profitability rows per client.

    Each row merges invoice totals, collected revenue, outstanding balance,
    logged hours, and open proposal count for one client.
    """

    rows: list[dict[str, Any]] = []
    for client in _client_queryset(organisation=organisation):
        invoices = list(client.invoices.all())
        invoiced_total = _sum_money([invoice.total for invoice in invoices])
        collected_total = _sum_money(
            [
                payment.amount
                for invoice in invoices
                for payment in invoice.payments.all()
            ]
        )
        outstanding_total = _sum_money(
            [_invoice_outstanding_amount(invoice) for invoice in invoices]
        )

        projects = list(client.projects.all())
        time_logs = [
            time_log for project in projects for time_log in project.time_logs.all()
        ]
        total_hours = sum(float(time_log.hours) for time_log in time_logs)
        billable_hours = sum(
            float(time_log.hours) for time_log in time_logs if time_log.is_billable
        )
        effective_rate = (
            _to_money(invoiced_total / Decimal(str(billable_hours)))
            if billable_hours
            else ZERO_MONEY
        )
        open_proposals = sum(
            1
            for proposal in client.proposals.all()
            if proposal.status
            not in {Proposal.ProposalStatus.WON, Proposal.ProposalStatus.LOST}
        )
        rows.append(
            {
                "client_id": client.id,
                "client_name": client.name,
                "invoiced_ghs": _money_str(invoiced_total),
                "collected_ghs": _money_str(collected_total),
                "outstanding_ghs": _money_str(outstanding_total),
                "total_hours": round(total_hours, 2),
                "billable_hours": round(billable_hours, 2),
                "effective_rate_ghs": _money_str(effective_rate),
                "open_proposals": open_proposals,
            }
        )

    sort_map = {
        "revenue": lambda row: Decimal(row["invoiced_ghs"]),
        "hours": lambda row: Decimal(str(row["billable_hours"])),
        "rate": lambda row: Decimal(row["effective_rate_ghs"]),
    }
    key_fn = sort_map.get(sort_by, sort_map["revenue"])
    rows.sort(key=key_fn, reverse=True)
    return rows


def get_project_budget_burn(*, organisation: Organisation) -> list[dict]:
    """
    Return budget-burn rows per project ordered by highest burn first.
    """

    rows: list[dict[str, Any]] = []
    for project in _project_queryset(organisation=organisation):
        invoices = list(project.invoices.all())
        invoiced_total = _sum_money([invoice.total for invoice in invoices])
        collected_total = _sum_money(
            [
                payment.amount
                for invoice in invoices
                for payment in invoice.payments.all()
            ]
        )
        time_logs = list(project.time_logs.all())
        total_hours = sum(float(time_log.hours) for time_log in time_logs)
        billable_hours = sum(
            float(time_log.hours) for time_log in time_logs if time_log.is_billable
        )
        if project.budget > ZERO_MONEY:
            burn_pct = float(
                _to_money(invoiced_total / project.budget) * Decimal("100")
            )
        else:
            burn_pct = 0.0
        rows.append(
            {
                "project_id": project.id,
                "title": project.title,
                "client_name": project.client.name,
                "budget_ghs": _money_str(project.budget),
                "invoiced_ghs": _money_str(invoiced_total),
                "collected_ghs": _money_str(collected_total),
                "total_hours": round(total_hours, 2),
                "billable_hours": round(billable_hours, 2),
                "burn_pct": round(burn_pct, 2),
                "status": project.status,
            }
        )

    rows.sort(key=lambda row: Decimal(str(row["burn_pct"])), reverse=True)
    return rows


def build_ai_context(*, organisation: Organisation) -> str:
    """
    Return a capped plain-text operating summary for one organisation.

    The output is shared infrastructure for rule-based assistant replies, Celery
    jobs, and later deterministic automations.
    """

    revenue_summary = get_revenue_summary(organisation=organisation)
    top_clients = get_client_profitability(
        organisation=organisation, sort_by="revenue"
    )[:5]
    open_proposals = (
        _proposal_queryset(organisation=organisation)
        .exclude(status__in=[Proposal.ProposalStatus.WON, Proposal.ProposalStatus.LOST])
        .order_by("deadline", "-created_at")[:5]
    )
    overdue_invoices = (
        _invoice_queryset(organisation=organisation)
        .exclude(status=Invoice.InvoiceStatus.PAID)
        .filter(due_date__lt=timezone.localdate())
        .order_by("due_date", "-created_at")[:5]
    )
    active_projects = [
        row
        for row in get_project_budget_burn(organisation=organisation)
        if row["status"]
        in {
            Project.ProjectStatus.PLANNING,
            Project.ProjectStatus.ACTIVE,
            Project.ProjectStatus.HOLD,
        }
    ][:5]

    parts = [
        f"{organisation.name} operating summary.",
        (
            f"Revenue this month: GHS {revenue_summary['this_month_collected']}. "
            f"Outstanding receivables: GHS {revenue_summary['total_outstanding']}. "
            f"Overdue invoices: {revenue_summary['overdue_count']} worth GHS {revenue_summary['overdue_total']}."
        ),
    ]

    if top_clients:
        parts.append(
            "Top clients: "
            + "; ".join(
                f"{client['client_name']} (invoiced GHS {client['invoiced_ghs']}, "
                f"rate GHS {client['effective_rate_ghs']}/h)"
                for client in top_clients
            )
            + "."
        )

    if open_proposals:
        parts.append(
            "Open proposals: "
            + "; ".join(
                f"{proposal.title} for {proposal.client.name} at GHS {_money_str(proposal.amount)} "
                f"due {proposal.deadline:%d %b %Y}"
                for proposal in open_proposals
            )
            + "."
        )

    if overdue_invoices:
        parts.append(
            "Overdue invoices: "
            + "; ".join(
                f"{invoice.client.name} owes GHS {_money_str(_invoice_outstanding_amount(invoice))}"
                for invoice in overdue_invoices
            )
            + "."
        )

    if active_projects:
        parts.append(
            "Active projects: "
            + "; ".join(
                f"{project['title']} ({project['burn_pct']:.2f}% burn, "
                f"GHS {project['invoiced_ghs']} invoiced)"
                for project in active_projects
            )
            + "."
        )

    context = " ".join(parts)
    return context[:8000]
