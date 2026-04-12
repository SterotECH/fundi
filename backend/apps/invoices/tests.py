
from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.core.models import AuditLog
from apps.invoices import services
from apps.invoices.factories import InvoiceFactory, PaymentFactory
from apps.invoices.models import Invoice, InvoiceLineItem, Payment


@pytest.mark.django_db
def test_create_invoice_service_writes_audit_logs_for_invoice_and_line_items(org):
    client = ClientFactory(organisation=org)

    invoice = services.create_invoice(
        organisation=org,
        data={
            "client": client,
            "project": None,
            "due_date": timezone.localdate() + timedelta(days=30),
            "line_items": [
                {
                    "description": "UI design",
                    "quantity": Decimal("2.00"),
                    "unit_price": Decimal("500.00"),
                },
                {
                    "description": "API integration",
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("700.00"),
                },
            ],
        },
    )

    assert AuditLog.objects.filter(
        entity_type="Invoice",
        entity_id=invoice.id,
        action=AuditLog.Action.CREATED,
    ).exists()
    assert AuditLog.objects.filter(
        entity_type="InvoiceLineItem",
        action=AuditLog.Action.CREATED,
    ).count() == 2
    assert InvoiceLineItem.objects.filter(invoice=invoice).count() == 2


@pytest.mark.django_db
def test_record_payment_service_writes_payment_audit_log_and_status_change(org):
    invoice = InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.SENT,
        total=Decimal("1000.00"),
        subtotal=Decimal("1000.00"),
    )

    payment = services.record_payment(
        invoice=invoice,
        data={
            "amount": Decimal("400.00"),
            "method": Payment.PaymentMethod.MTN_MOMO,
            "provider_reference": "MOMO-123",
            "payment_date": timezone.localdate(),
        },
    )

    invoice.refresh_from_db()
    assert payment.amount == Decimal("400.00")
    assert invoice.status == "partial"
    assert AuditLog.objects.filter(
        entity_type="Payment",
        entity_id=payment.id,
        action=AuditLog.Action.CREATED,
    ).exists()
    assert AuditLog.objects.filter(
        entity_type="Invoice",
        entity_id=invoice.id,
        action=AuditLog.Action.STATUS_CHANGED,
    ).exists()


@pytest.mark.django_db
def test_create_invoice_endpoint_records_authenticated_user_in_audit_log(
    authenticated_client,
    user,
):
    client = ClientFactory(organisation=user.organisation)

    response = authenticated_client.post(
        reverse("invoice-list"),
        {
            "client_id": str(client.id),
            "due_date": str(timezone.localdate() + timedelta(days=30)),
            "line_items": [
                {
                    "description": "Discovery",
                    "quantity": "1.00",
                    "unit_price": "1200.00",
                }
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    audit_log = AuditLog.objects.filter(
        entity_type="Invoice",
        entity_id=response.json()["id"],
        action=AuditLog.Action.CREATED,
    ).latest("timestamp")
    assert audit_log.user == user


@pytest.mark.django_db
def test_create_invoice_accepts_notes(authenticated_client, user):
    client = ClientFactory(organisation=user.organisation)

    response = authenticated_client.post(
        reverse("invoice-list"),
        {
            "client_id": str(client.id),
            "due_date": str(timezone.localdate() + timedelta(days=30)),
            "notes": "Pay within 7 days of issuance.",
            "line_items": [
                {
                    "description": "Discovery",
                    "quantity": "1.00",
                    "unit_price": "1200.00",
                }
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["notes"] == "Pay within 7 days of issuance."


@pytest.mark.django_db
def test_update_invoice_service_replaces_line_items_and_audits_create_delete(org):
    client = ClientFactory(organisation=org)
    invoice = services.create_invoice(
        organisation=org,
        data={
            "client": client,
            "project": None,
            "due_date": timezone.localdate() + timedelta(days=30),
            "line_items": [
                {
                    "description": "Old item",
                    "quantity": Decimal("1.00"),
                    "unit_price": Decimal("100.00"),
                }
            ],
        },
    )
    original_line_item = invoice.line_items.get()

    updated = services.update_invoice(
        invoice=invoice,
        data={
            "line_items": [
                {
                    "description": "New item",
                    "quantity": Decimal("2.00"),
                    "unit_price": Decimal("300.00"),
                }
            ]
        },
    )

    assert updated.total == Decimal("600.00")
    assert not InvoiceLineItem.objects.filter(id=original_line_item.id).exists()
    assert AuditLog.objects.filter(
        entity_type="InvoiceLineItem",
        entity_id=original_line_item.id,
        action=AuditLog.Action.DELETED,
    ).exists()
    assert AuditLog.objects.filter(
        entity_type="InvoiceLineItem",
        action=AuditLog.Action.CREATED,
    ).count() >= 2


@pytest.mark.django_db
def test_list_invoices_endpoint_is_organisation_scoped(authenticated_client, org):
    own = InvoiceFactory(organisation=org)
    InvoiceFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(reverse("invoice-list"))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(own.id)


@pytest.mark.django_db
def test_retrieve_invoice_returns_404_for_other_organisation(authenticated_client):
    other = InvoiceFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("invoice-detail", kwargs={"pk": other.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_invoice_rejects_other_organisation_client(authenticated_client):
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.post(
        reverse("invoice-list"),
        {
            "client_id": str(other_client.id),
            "due_date": str(timezone.localdate() + timedelta(days=30)),
            "line_items": [
                {
                    "description": "Discovery",
                    "quantity": "1.00",
                    "unit_price": "500.00",
                }
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "client_id" in response.json()


@pytest.mark.django_db
def test_overdue_invoices_endpoint_returns_only_overdue_unpaid(
    authenticated_client,
    org,
):
    overdue = InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.SENT,
        due_date=timezone.localdate() - timedelta(days=1),
    )
    InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.PAID,
        due_date=timezone.localdate() - timedelta(days=2),
    )
    InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.SENT,
        due_date=timezone.localdate() + timedelta(days=2),
    )

    response = authenticated_client.get(reverse("invoice-overdue"))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(overdue.id)


@pytest.mark.django_db
def test_send_invoice_endpoint_assigns_number_and_status(authenticated_client, org):
    invoice = InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.DRAFT,
        invoice_number=None,
    )

    response = authenticated_client.post(
        reverse("invoice-send", kwargs={"pk": invoice.id}),
        {},
        format="json",
    )

    invoice.refresh_from_db()
    assert response.status_code == 200
    assert invoice.status == Invoice.InvoiceStatus.SENT
    assert invoice.invoice_number is not None
    assert invoice.invoice_number.startswith(f"STERO-{timezone.now().year}-")


@pytest.mark.django_db
def test_delete_invoice_endpoint_allows_draft_and_rejects_non_draft(
    authenticated_client,
    org,
):
    draft = InvoiceFactory(organisation=org, status=Invoice.InvoiceStatus.DRAFT)
    sent = InvoiceFactory(organisation=org, status=Invoice.InvoiceStatus.SENT)

    response = authenticated_client.delete(
        reverse("invoice-detail", kwargs={"pk": draft.id}),
    )
    assert response.status_code == 204
    assert not Invoice.objects.filter(id=draft.id).exists()

    response = authenticated_client.delete(
        reverse("invoice-detail", kwargs={"pk": sent.id}),
    )
    assert response.status_code == 400
    assert Invoice.objects.filter(id=sent.id).exists()


@pytest.mark.django_db
def test_invoice_payments_routes_list_create_and_delete(authenticated_client, org):
    invoice = InvoiceFactory(
        organisation=org,
        status=Invoice.InvoiceStatus.SENT,
        total=Decimal("1000.00"),
    )
    existing_payment = PaymentFactory(invoice=invoice, amount=Decimal("300.00"))

    response = authenticated_client.get(
        reverse("invoice-payments", kwargs={"pk": invoice.id}),
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == str(existing_payment.id)
    assert response.json()[0]["running_balance"] == "700.00"

    response = authenticated_client.post(
        reverse("invoice-payments", kwargs={"pk": invoice.id}),
        {
            "amount": "200.00",
            "method": Payment.PaymentMethod.BANK,
            "provider_reference": "BANK-001",
            "notes": "Bank transfer received",
            "payment_date": str(timezone.localdate()),
        },
        format="json",
    )
    assert response.status_code == 201
    created_payment_id = response.json()["id"]
    assert response.json()["notes"] == "Bank transfer received"
    assert response.json()["running_balance"] == "500.00"
    invoice.refresh_from_db()
    assert invoice.status == Invoice.InvoiceStatus.PARTIAL

    response = authenticated_client.delete(
        reverse(
            "invoice-delete-payment",
            kwargs={"pk": invoice.id, "payment_id": created_payment_id},
        ),
    )
    assert response.status_code == 204
    assert not Payment.objects.filter(id=created_payment_id).exists()


@pytest.mark.django_db
def test_invoice_payment_delete_route_is_scoped_by_invoice(authenticated_client, org):
    invoice = InvoiceFactory(organisation=org, status=Invoice.InvoiceStatus.SENT)
    other_invoice = InvoiceFactory(organisation=org, status=Invoice.InvoiceStatus.SENT)
    payment = PaymentFactory(invoice=other_invoice)

    response = authenticated_client.delete(
        reverse(
            "invoice-delete-payment",
            kwargs={"pk": invoice.id, "payment_id": payment.id},
        ),
    )

    assert response.status_code == 404
    assert Payment.objects.filter(id=payment.id).exists()
