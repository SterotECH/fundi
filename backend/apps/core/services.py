from datetime import timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Count, Prefetch, Sum
from django.utils import timezone

from apps.accounts.models import Organisation, User
from apps.core.models import Notification
from apps.invoices.models import Invoice, Payment
from apps.projects.models import Project
from apps.proposals.models import Proposal

ZERO_MONEY = Decimal("0.00")


def _invoice_paid_amount(invoice: Invoice) -> Decimal:
    total = invoice.payments.aggregate(total=Sum("amount"))["total"]
    return total or ZERO_MONEY


def _invoice_remaining_amount(invoice: Invoice) -> Decimal:
    return max(invoice.total - _invoice_paid_amount(invoice), ZERO_MONEY)


def get_dashboard_summary(*, organisation: Organisation) -> dict[str, Any]:
    """
    Return the dashboard payload for one organisation, including Sprint 2 money
    and notification summary fields.
    """
    today = timezone.localdate()
    deadline_limit = today + timedelta(days=14)

    proposal_counts = {status: 0 for status, _label in Proposal.ProposalStatus.choices}
    counts = (
        Proposal.objects.filter(organisation=organisation)
        .values("status")
        .annotate(total=Count("id"))
    )
    for row in counts:
        proposal_counts[row["status"]] = row["total"]

    upcoming_deadlines = (
        Proposal.objects.select_related("client")
        .filter(
            organisation=organisation,
            deadline__gte=today,
            deadline__lte=deadline_limit,
        )
        .exclude(
            status__in=[
                Proposal.ProposalStatus.WON,
                Proposal.ProposalStatus.LOST,
            ]
        )
        .order_by("deadline", "-created_at")[:10]
    )

    active_projects = (
        Project.objects.select_related("client")
        .filter(
            organisation=organisation,
            status=Project.ProjectStatus.ACTIVE,
        )
        .order_by("due_date", "-created_at")[:10]
    )

    overdue_invoices = list(
        Invoice.objects.select_related("client")
        .prefetch_related(
            Prefetch("payments", queryset=Payment.objects.order_by("payment_date"))
        )
        .filter(organisation=organisation, due_date__lt=today)
        .exclude(status=Invoice.InvoiceStatus.PAID)
        .order_by("due_date", "-created_at")[:10]
    )

    outstanding_invoices = (
        Invoice.objects.select_related("client")
        .prefetch_related("payments")
        .filter(organisation=organisation)
        .exclude(status=Invoice.InvoiceStatus.PAID)
    )

    total_outstanding = sum(
        (
            max(invoice.total - _invoice_paid_amount(invoice), ZERO_MONEY)
            for invoice in outstanding_invoices
        ),
        ZERO_MONEY,
    )

    unread_notifications_count = Notification.objects.filter(
        user__organisation=organisation,
        is_read=False,
    ).count()

    return {
        "proposal_counts": proposal_counts,
        "upcoming_proposal_deadlines": [
            {
                "id": str(proposal.id),
                "title": proposal.title,
                "client": str(proposal.client_id),
                "client_name": proposal.client.name,
                "status": proposal.status,
                "deadline": proposal.deadline.isoformat(),
                "amount": str(proposal.amount),
            }
            for proposal in upcoming_deadlines
        ],
        "active_projects": [
            {
                "id": str(project.id),
                "title": project.title,
                "client": str(project.client_id),
                "client_name": project.client.name,
                "status": project.status,
                "due_date": project.due_date.isoformat(),
                "budget": str(project.budget),
            }
            for project in active_projects
        ],
        "total_outstanding": f"{total_outstanding:.2f}",
        "overdue_invoices": [
            {
                "id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "client": str(invoice.client_id),
                "client_name": invoice.client.name,
                "status": invoice.status,
                "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                "total": str(invoice.total),
                "amount_paid": f"{_invoice_paid_amount(invoice):.2f}",
                "amount_remaining": f"{_invoice_remaining_amount(invoice):.2f}",
            }
            for invoice in overdue_invoices
        ],
        "unread_notifications_count": unread_notifications_count,
    }


def list_notifications(*, user: User, filters: dict[str, Any]) -> dict[str, Any]:
    """
    Return notifications for one authenticated user plus unread metadata.

    The response shape mirrors the documented endpoint contract so the view can
    paginate or serialize `results` while still exposing `unread_count`.
    """
    queryset = Notification.objects.select_related("user").filter(user=user)

    read_filter = filters.get("read")
    if read_filter is not None:
        normalized = str(read_filter).strip().lower()
        if normalized in {"true", "1", "yes"}:
            queryset = queryset.filter(is_read=True)
        elif normalized in {"false", "0", "no"}:
            queryset = queryset.filter(is_read=False)

    return {
        "queryset": queryset.order_by("-created_at"),
        "unread_count": Notification.objects.filter(user=user, is_read=False).count(),
    }


def get_notification_detail(*, user: User, notification_id: str | UUID) -> Notification:
    """
    Return one notification scoped to the authenticated user.
    """
    return Notification.objects.select_related("user").get(
        id=notification_id,
        user=user,
    )


def mark_notification_read(*, notification: Notification) -> Notification:
    """
    Mark one notification as read if it is currently unread.
    """
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=["is_read"])

    return notification


def mark_all_notifications_read(*, user: User) -> int:
    """
    Mark all unread notifications for one user as read.

    Returns the number of rows updated so the caller can decide whether to
    return metadata or a bare `204`.
    """
    notifications = list(
        Notification.objects.filter(user=user, is_read=False).order_by("-created_at")
    )

    for notification in notifications:
        notification.is_read = True
        notification.save(update_fields=["is_read"])

    return len(notifications)


def create_notification(
    *,
    user: User,
    notification_type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
) -> Notification:
    """
    Create one notification row for a user-facing event.
    """
    return Notification.objects.create(
        user=user,
        type=notification_type,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
