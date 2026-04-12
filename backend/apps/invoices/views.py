from collections.abc import Mapping
from typing import Any, cast

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import Organisation, User
from apps.invoices import services
from apps.invoices.models import Invoice
from apps.invoices.serializers import (
    InvoiceDetailSerializer,
    InvoiceListSerializer,
    InvoiceSendSerializer,
    InvoiceWriteSerializer,
    PaymentReadSerializer,
    PaymentWriteSerializer,
)


class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_converter = "uuid"

    def get_queryset(self):
        organisation = getattr(self.request.user, "organisation", None)
        if organisation is None:
            return Invoice.objects.none()

        return services.list_invoices(
            organisation=organisation,
            filters=self.request.query_params,
        )

    def get_serializer_class(self):
        if self.action in {"create", "partial_update"}:
            return InvoiceWriteSerializer

        if self.action == "send":
            return InvoiceSendSerializer

        if self.action == "payments":
            if self.request.method == "POST":
                return PaymentWriteSerializer
            return PaymentReadSerializer

        if self.action in {"list", "overdue"}:
            return InvoiceListSerializer

        return InvoiceDetailSerializer

    def _get_invoice(self, pk: str) -> Invoice:
        user = cast(User, self.request.user)
        organisation = cast(Organisation, user.organisation)
        return services.get_invoice_detail(
            organisation=organisation,
            invoice_id=pk,
        )

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = InvoiceListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = InvoiceListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self._get_invoice(str(kwargs["pk"]))
        serializer = InvoiceDetailSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)
        user = cast(User, request.user)
        organisation = cast(Organisation, user.organisation)

        invoice = services.create_invoice(
            organisation=organisation,
            data=validated_data,
        )
        response_serializer = InvoiceDetailSerializer(invoice)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> Response:
        invoice = self._get_invoice(str(kwargs["pk"]))
        serializer = self.get_serializer(
            invoice,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        invoice = services.update_invoice(
            invoice=invoice,
            data=validated_data,
        )
        response_serializer = InvoiceDetailSerializer(invoice)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self._get_invoice(str(kwargs["pk"]))
        services.delete_invoice(invoice=invoice)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="overdue")
    def overdue(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        user = cast(User, request.user)
        organisation = cast(Organisation, user.organisation)
        queryset = services.list_overdue_invoices(organisation=organisation)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = InvoiceListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = InvoiceListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="send")
    def send(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self._get_invoice(str(kwargs["pk"]))
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = services.send_invoice(invoice=invoice)
        response_serializer = InvoiceDetailSerializer(invoice)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"], url_path="payments")
    def payments(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self._get_invoice(str(kwargs["pk"]))

        if request.method == "GET":
            payments = services.list_invoice_payments(invoice=invoice)
            serializer = PaymentReadSerializer(payments, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], write_serializer.validated_data)

        payment = services.record_payment(
            invoice=invoice,
            data=validated_data,
        )
        response_serializer = PaymentReadSerializer(payment)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path="payments/<uuid:payment_id>",
    )
    def delete_payment(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> Response:
        invoice = self._get_invoice(str(kwargs["pk"]))
        payment = services.get_payment_detail(
            invoice=invoice,
            payment_id=str(kwargs["payment_id"]),
        )
        services.delete_payment(payment=payment)
        return Response(status=status.HTTP_204_NO_CONTENT)
