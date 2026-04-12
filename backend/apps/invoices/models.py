from typing import TYPE_CHECKING
from uuid import UUID

from django.db import models

from apps.core.models import BaseModel

if TYPE_CHECKING:
    from django.db.models.manager import Manager as RelatedManager


class Invoice(BaseModel):
    class InvoiceStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    organisation = models.ForeignKey(
        "accounts.Organisation",
        on_delete=models.CASCADE,
        related_name="invoices",
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.CASCADE,
        related_name="invoices",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="invoices",
        null=True,
        blank=True,
    )
    if TYPE_CHECKING:
        organisation_id: UUID
        client_id: UUID
        project_id: UUID | None
        line_items: RelatedManager["InvoiceLineItem"]
        payments: RelatedManager["Payment"]

    invoice_number = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    tax = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT,
    )
    notes = models.TextField(blank=True)
    due_date = models.DateField(
        null=True,
        blank=True,
    )
    issue_date = models.DateField(
        null=True,
        blank=True,
    )


class InvoiceLineItem(BaseModel):
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="line_items",
    )
    if TYPE_CHECKING:
        invoice_id: UUID

    description = models.CharField(
        max_length=255,
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

class Payment(BaseModel):
    class PaymentMethod(models.TextChoices):
        MTN_MOMO = "mtn_momo", "MTN Momo"
        TELECEL = "telecel", "Telecel"
        AIRTEL_TIGO = "airtel_tigo", "Airtel Tigo"
        CASH = "cash", "Cash"
        BANK = "bank", "Bank"

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    if TYPE_CHECKING:
        invoice_id: UUID

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    provider_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)
    payment_date = models.DateField()
    method = models.CharField(
        max_length=50,
        choices=PaymentMethod.choices,
    )
