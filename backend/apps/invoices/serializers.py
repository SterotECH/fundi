from decimal import Decimal
from typing import Any, cast

from rest_framework import serializers

from apps.clients.models import Client
from apps.invoices.models import Invoice, InvoiceLineItem, Payment
from apps.projects.models import Project

ZERO_MONEY = Decimal("0.00")


class InvoiceLineItemWriteSerializer(serializers.ModelSerializer):
    def validate_quantity(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Quantity must be positive.")
        return value

    def validate_unit_price(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Unit price must be positive.")
        return value

    class Meta:
        model = InvoiceLineItem
        fields = [
            "description",
            "quantity",
            "unit_price",
        ]


class InvoiceLineItemReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = [
            "id",
            "description",
            "quantity",
            "unit_price",
            "line_total",
            "created_at",
            "updated_at",
        ]


class PaymentWriteSerializer(serializers.ModelSerializer):
    def validate_amount(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    class Meta:
        model = Payment
        fields = [
            "amount",
            "method",
            "provider_reference",
            "notes",
            "payment_date",
        ]


class PaymentReadSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    running_balance = serializers.SerializerMethodField()

    def get_running_balance(self, obj: Payment) -> str:
        running_balance = getattr(obj, "running_balance", None)
        if running_balance is None:
            invoice = obj.invoice
            payments = list(
                invoice.payments.order_by(
                    "payment_date",
                    "created_at",
                    "id",
                ).values_list("id", "amount")
            )
            remaining = invoice.total
            for payment_id, amount in payments:
                remaining -= amount
                if payment_id == obj.id:
                    running_balance = remaining
                    break

        if running_balance is None:
            running_balance = obj.invoice.total - obj.amount

        return f"{running_balance:.2f}"

    class Meta:
        model = Payment
        fields = [
            "id",
            "amount",
            "method",
            "method_display",
            "provider_reference",
            "notes",
            "payment_date",
            "running_balance",
            "created_at",
            "updated_at",
        ]


class InvoiceListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    amount_paid = serializers.SerializerMethodField()
    amount_remaining = serializers.SerializerMethodField()

    def get_amount_paid(self, obj: Invoice) -> str:
        amount = getattr(obj, "amount_paid", None)
        if amount is None:
            amount = sum((payment.amount for payment in obj.payments.all()), ZERO_MONEY)
        return f"{amount:.2f}"

    def get_amount_remaining(self, obj: Invoice) -> str:
        amount = getattr(obj, "amount_remaining", None)
        if amount is None:
            paid_amount = getattr(obj, "amount_paid", None)
            if paid_amount is None:
                paid_amount = sum(
                    (payment.amount for payment in obj.payments.all()),
                    ZERO_MONEY,
                )
            amount = obj.total - paid_amount
        return f"{amount:.2f}"

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "client",
            "client_name",
            "project",
            "project_title",
            "status",
            "notes",
            "issue_date",
            "due_date",
            "subtotal",
            "tax",
            "total",
            "amount_paid",
            "amount_remaining",
            "created_at",
        ]


class InvoiceDetailSerializer(InvoiceListSerializer):
    line_items = InvoiceLineItemReadSerializer(many=True, read_only=True)
    payments = PaymentReadSerializer(many=True, read_only=True)

    class Meta(InvoiceListSerializer.Meta):
        fields = InvoiceListSerializer.Meta.fields + [
            "line_items",
            "payments",
            "updated_at",
        ]


class InvoiceWriteSerializer(serializers.ModelSerializer):
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source="client",
    )
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
        required=False,
        allow_null=True,
    )
    line_items = InvoiceLineItemWriteSerializer(many=True)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        organisation = getattr(getattr(request, "user", None), "organisation", None)
        client_id = cast(serializers.PrimaryKeyRelatedField, self.fields["client_id"])
        project_id = cast(serializers.PrimaryKeyRelatedField, self.fields["project_id"])

        if organisation is None:
            client_id.queryset = Client.objects.none()
            project_id.queryset = Project.objects.none()
            return

        client_id.queryset = Client.objects.filter(organisation=organisation)
        project_id.queryset = Project.objects.filter(organisation=organisation)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        client = attrs.get("client") or getattr(self.instance, "client", None)
        project = attrs.get("project", getattr(self.instance, "project", None))

        if (
            project is not None
            and client is not None
            and project.client_id != client.id
        ):
            raise serializers.ValidationError(
                {"project_id": "Project must belong to the selected client."}
            )

        return attrs

    def validate_line_items(
        self, value: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        if not value:
            raise serializers.ValidationError("At least one line item is required.")
        return value

    class Meta:
        model = Invoice
        fields = [
            "client_id",
            "project_id",
            "due_date",
            "notes",
            "line_items",
        ]


class InvoiceSendSerializer(serializers.Serializer):
    pass
