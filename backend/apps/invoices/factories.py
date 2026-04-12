from datetime import timedelta
from decimal import Decimal
from typing import Any

import factory
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.invoices.models import Invoice, InvoiceLineItem, Payment
from apps.projects.factories import ProjectFactory


class InvoiceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Invoice

    organisation = factory.SubFactory(OrganisationFactory)
    client = factory.SubFactory(
        ClientFactory,
        organisation=factory.SelfAttribute("..organisation"),
    )
    project: Any = None
    invoice_number = None
    subtotal = Decimal("1000.00")
    tax = Decimal("0.00")
    total = Decimal("1000.00")
    status = Invoice.InvoiceStatus.DRAFT
    notes = ""
    due_date = factory.LazyFunction(
        lambda: timezone.localdate() + timedelta(days=30)
    )
    issue_date = factory.LazyFunction(timezone.localdate)


class ProjectInvoiceFactory(InvoiceFactory):
    project = factory.SubFactory(
        ProjectFactory,
        organisation=factory.SelfAttribute("..organisation"),
        client=factory.SelfAttribute("..client"),
    )


class InvoiceLineItemFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = InvoiceLineItem

    invoice = factory.SubFactory(InvoiceFactory)
    description = factory.Sequence(lambda number: f"Line item {number}")
    quantity = Decimal("2.00")
    unit_price = Decimal("500.00")
    line_total = Decimal("1000.00")


class PaymentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Payment

    invoice = factory.SubFactory(InvoiceFactory)
    amount = Decimal("500.00")
    provider_reference = factory.Sequence(lambda number: f"PAY-{number}")
    notes = ""
    payment_date = factory.LazyFunction(timezone.localdate)
    method = Payment.PaymentMethod.MTN_MOMO
