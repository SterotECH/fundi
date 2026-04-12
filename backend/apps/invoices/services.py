from collections.abc import Mapping
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.db import connection, transaction
from django.db.models import Prefetch, QuerySet, Sum
from django.utils import timezone

from apps.accounts.models import Organisation
from apps.invoices.exceptions import (
    CannotDeleteInvoiceError,
    CannotSendInvoiceError,
    CannotUpdateInvoiceError,
    InvalidInvoiceClientError,
    InvalidInvoiceLineItemError,
    InvalidInvoiceProjectError,
    InvalidPaymentAmountError,
)
from apps.invoices.models import Invoice, InvoiceLineItem, Payment

MONEY_QUANT = Decimal("0.01")
ZERO_MONEY = Decimal("0.00")


def list_invoices(
    *, organisation: Organisation, filters: Mapping[str, Any]
) -> QuerySet[Invoice]:
    """
    Return organisation-scoped invoices with optional Sprint 2 filters.

    Supported filters are `status`, `client_id`, and `project_id`. Related
    rows needed by serializers are loaded explicitly to avoid list-page query
    surprises.
    """
    queryset = (
        Invoice.objects.select_related("organisation", "client", "project")
        .prefetch_related("payments")
        .filter(organisation=organisation)
    )

    status_filter = filters.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    client_id_filter = filters.get("client_id")
    if client_id_filter:
        queryset = queryset.filter(client_id=client_id_filter)

    project_id_filter = filters.get("project_id")
    if project_id_filter:
        queryset = queryset.filter(project_id=project_id_filter)

    return queryset.order_by("-issue_date", "-created_at")


def list_overdue_invoices(*, organisation: Organisation) -> QuerySet[Invoice]:
    """
    Return unpaid invoices past due for the authenticated organisation.
    """
    today = timezone.localdate()
    return (
        Invoice.objects.select_related("organisation", "client", "project")
        .prefetch_related("payments")
        .filter(organisation=organisation, due_date__lt=today)
        .exclude(status=Invoice.InvoiceStatus.PAID)
        .order_by("due_date", "-created_at")
    )


def get_invoice_detail(*, organisation: Organisation, invoice_id: str) -> Invoice:
    """
    Return one invoice scoped to the authenticated user's organisation.
    """
    return (
        Invoice.objects.select_related("organisation", "client", "project")
        .prefetch_related(
            "payments",
            Prefetch(
                "line_items",
                queryset=InvoiceLineItem.objects.order_by("created_at"),
            ),
        )
        .get(id=invoice_id, organisation=organisation)
    )


def _to_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _validate_invoice_relationships(
    *, organisation: Organisation, data: Mapping[str, Any]
) -> None:
    client = data.get("client")
    project = data.get("project")

    if client is None or client.organisation_id != organisation.id:
        raise InvalidInvoiceClientError()

    if project is None:
        return

    if project.organisation_id != organisation.id:
        raise InvalidInvoiceProjectError()

    if project.client_id != client.id:
        raise InvalidInvoiceProjectError()


def _calculate_line_total(item: Mapping[str, Any]) -> Decimal:
    quantity = item["quantity"]
    unit_price = item["unit_price"]
    if quantity <= 0 or unit_price <= 0:
        raise InvalidInvoiceLineItemError()

    return _to_money(quantity * unit_price)


def _calculate_invoice_totals(
    line_items_data: list[Mapping[str, Any]],
) -> tuple[Decimal, Decimal, Decimal]:
    if not line_items_data:
        raise InvalidInvoiceLineItemError()

    subtotal = sum(
        (_calculate_line_total(item) for item in line_items_data),
        ZERO_MONEY,
    )
    subtotal = _to_money(subtotal)
    tax = ZERO_MONEY
    total = _to_money(subtotal + tax)
    return subtotal, tax, total


@transaction.atomic
def create_invoice(*, organisation: Organisation, data: Mapping[str, Any]) -> Invoice:
    """
    Create a draft invoice with nested line items.

    The API does not accept `subtotal`, `tax`, `total`, `status`, or
    `invoice_number` from the client. Those values are server-owned and are
    derived here from the submitted line items and state machine.
    """
    _validate_invoice_relationships(organisation=organisation, data=data)
    line_items_data = list(data.get("line_items", []))
    subtotal, tax, total = _calculate_invoice_totals(line_items_data)
    today = timezone.localdate()

    invoice = Invoice.objects.create(
        organisation=organisation,
        client=data["client"],
        project=data.get("project"),
        subtotal=subtotal,
        tax=tax,
        total=total,
        status=Invoice.InvoiceStatus.DRAFT,
        notes=data.get("notes", ""),
        issue_date=data.get("issue_date") or today,
        due_date=data.get("due_date") or today + timedelta(days=30),
    )

    for item in line_items_data:
        InvoiceLineItem.objects.create(
            invoice=invoice,
            description=item["description"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            line_total=_calculate_line_total(item),
        )

    return get_invoice_detail(
        organisation=organisation,
        invoice_id=str(invoice.id),
    )


@transaction.atomic
def update_invoice(*, invoice: Invoice, data: Mapping[str, Any]) -> Invoice:
    """
    Update a draft invoice and optionally replace its line items.

    Sent, partial, paid, and overdue invoices are financial records, so the
    service rejects mutation after the draft stage.
    """
    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
    if invoice.status != Invoice.InvoiceStatus.DRAFT:
        raise CannotUpdateInvoiceError()

    update_data = {
        "client": data.get("client", invoice.client),
        "project": data.get("project", invoice.project),
    }
    _validate_invoice_relationships(
        organisation=invoice.organisation,
        data=update_data,
    )

    invoice.client = update_data["client"]
    invoice.project = update_data["project"]

    if "due_date" in data:
        invoice.due_date = data["due_date"]
    if "notes" in data:
        invoice.notes = data["notes"]

    line_items_data = data.get("line_items")
    if line_items_data is not None:
        line_items_data = list(line_items_data)
        subtotal, tax, total = _calculate_invoice_totals(line_items_data)
        invoice.subtotal = subtotal
        invoice.tax = tax
        invoice.total = total
        invoice.line_items.all().delete()
        for item in line_items_data:
            InvoiceLineItem.objects.create(
                invoice=invoice,
                description=item["description"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                line_total=_calculate_line_total(item),
            )

    invoice.save()
    return get_invoice_detail(
        organisation=invoice.organisation,
        invoice_id=str(invoice.id),
    )


def generate_invoice_number() -> str:
    """
    Return the next human-facing invoice number from the Postgres sequence.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('stero_invoice_seq')")
        sequence_number = cursor.fetchone()[0]

    year = timezone.now().year
    return f"STERO-{year}-{sequence_number:04d}"


@transaction.atomic
def send_invoice(*, invoice: Invoice) -> Invoice:
    """
    Move a draft invoice to sent and assign an atomic invoice number.
    """
    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
    if invoice.status != Invoice.InvoiceStatus.DRAFT:
        raise CannotSendInvoiceError()

    if not invoice.invoice_number:
        invoice.invoice_number = generate_invoice_number()

    invoice.status = Invoice.InvoiceStatus.SENT
    invoice.issue_date = invoice.issue_date or timezone.localdate()
    invoice.save(update_fields=["invoice_number", "status", "issue_date", "updated_at"])
    return invoice


def _payment_total(*, invoice: Invoice) -> Decimal:
    total = invoice.payments.aggregate(total=Sum("amount"))["total"]
    return total or ZERO_MONEY


@transaction.atomic
def recalculate_invoice_status(*, invoice: Invoice) -> Invoice:
    """
    Recompute status from payments and due date.

    Draft invoices stay draft. Sent invoices can become overdue, partial, or
    paid. Partial invoices that pass their due date become overdue until fully
    paid.
    """
    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
    if invoice.status == Invoice.InvoiceStatus.DRAFT:
        return invoice

    paid_amount = _payment_total(invoice=invoice)
    today = timezone.localdate()

    if paid_amount >= invoice.total:
        new_status = Invoice.InvoiceStatus.PAID
    elif invoice.due_date and invoice.due_date < today:
        new_status = Invoice.InvoiceStatus.OVERDUE
    elif paid_amount > ZERO_MONEY:
        new_status = Invoice.InvoiceStatus.PARTIAL
    else:
        new_status = Invoice.InvoiceStatus.SENT

    if invoice.status != new_status:
        invoice.status = new_status
        invoice.save(update_fields=["status", "updated_at"])

    return invoice


def list_invoice_payments(*, invoice: Invoice) -> QuerySet[Payment]:
    """
    Return payments for an already organisation-scoped invoice.
    """
    return invoice.payments.order_by("payment_date", "created_at")


def get_payment_detail(*, invoice: Invoice, payment_id: str) -> Payment:
    """
    Return one payment that belongs to the already scoped invoice.
    """
    return invoice.payments.get(id=payment_id)


@transaction.atomic
def record_payment(*, invoice: Invoice, data: Mapping[str, Any]) -> Payment:
    """
    Record a payment and synchronously update the invoice status.
    """
    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
    amount = data["amount"]
    if amount <= 0:
        raise InvalidPaymentAmountError()

    payment = Payment.objects.create(
        invoice=invoice,
        amount=amount,
        method=data["method"],
        provider_reference=data.get("provider_reference"),
        notes=data.get("notes", ""),
        payment_date=data["payment_date"],
    )
    recalculate_invoice_status(invoice=invoice)
    return payment


@transaction.atomic
def delete_payment(*, payment: Payment) -> None:
    """
    Delete a payment and synchronously update the invoice status.
    """
    invoice = Invoice.objects.select_for_update().get(id=payment.invoice_id)
    payment.delete()
    recalculate_invoice_status(invoice=invoice)


def delete_invoice(*, invoice: Invoice) -> None:
    """
    Delete an invoice only while it is still draft.
    """
    if invoice.status != Invoice.InvoiceStatus.DRAFT:
        raise CannotDeleteInvoiceError()

    invoice.delete()
