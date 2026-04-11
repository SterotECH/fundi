from collections.abc import Mapping
from typing import Any, cast

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.clients import services
from apps.clients.models import Client, Lead
from apps.clients.serializers import (
    ClientDetailSerializer,
    ClientInvoiceListItemSerializer,
    ClientListSerializer,
    ClientProjectListItemSerializer,
    ClientProposalListItemSerializer,
    ClientWriteSerializer,
    ConvertLeadToClientSerializer,
    LeadDetailSerializer,
    LeadListSerializer,
    LeadWriteSerializer,
)


class ClientViewSet(viewsets.ModelViewSet):
    """
    ViewSet for client CRUD and client-scoped related endpoints.

    Why this is a `ModelViewSet`:
    - `/clients/` maps to `list` and `create`
    - `/clients/{id}/` maps to `retrieve`, `partial_update`, and `destroy`
    - related client endpoints use `@action(detail=True)`
    - routers now own URL generation instead of hand-written duplicate paths

    Missing client handling is delegated to the project's global exception
    handler. The service raises `Client.DoesNotExist`, then
    `backend/utils/exceptions.py` turns that into a standard HTTP 404 response.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_converter = "uuid"

    list_service = staticmethod(services.list_clients)
    create_service = staticmethod(services.create_client)
    detail_service = staticmethod(services.get_client_detail)
    update_service = staticmethod(services.update_client)
    archive_service = staticmethod(services.archive_client)
    proposals_service = staticmethod(services.list_client_proposals)
    invoices_service = staticmethod(services.list_client_invoices)
    projects_service = staticmethod(services.list_client_projects)

    def get_queryset(self):
        """
        Return the organisation-scoped queryset used by list views and schema tools.
        """
        organisation = getattr(self.request.user, "organisation", None)
        if organisation is None:
            return Client.objects.none()

        return self.list_service(
            organisation=organisation,
            filters=self.request.query_params,
        )

    def get_serializer_class(self):
        """
        Use serializers by endpoint shape, not by model only.
        """
        if self.action == "list":
            return ClientListSerializer

        if self.action in {"create", "partial_update"}:
            return ClientWriteSerializer

        if self.action == "proposals":
            return ClientProposalListItemSerializer

        if self.action == "invoices":
            return ClientInvoiceListItemSerializer

        if self.action == "projects":
            return ClientProjectListItemSerializer

        return ClientDetailSerializer

    def _get_client(self, pk) -> Client:
        """
        Fetch one client through the service layer.

        If the client does not exist inside the authenticated user's
        organisation, the service raises `Client.DoesNotExist`. The global DRF
        exception handler converts that into a 404, so the view does not need a
        local try/except block.
        """
        return self.detail_service(
            organisation=self.request.user.organisation,
            client_id=str(pk),
        )

    def list(self, request, *args, **kwargs):
        """
        Return a paginated list of clients for the authenticated organisation.
        """
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ClientListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ClientListSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        Create one client for the authenticated user's organisation.
        """
        serializer = ClientWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        client = self.create_service(
            organisation=request.user.organisation,
            data=validated_data,
        )

        response_serializer = ClientDetailSerializer(client)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        """
        Return one organisation-scoped client detail record.
        """
        client = self._get_client(self.kwargs[self.lookup_field])
        serializer = ClientDetailSerializer(client)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """
        Partially update one organisation-scoped client and return the new state.
        """
        serializer = ClientWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        client = self.update_service(
            client=self._get_client(self.kwargs[self.lookup_field]),
            data=validated_data,
        )

        response_serializer = ClientDetailSerializer(client)
        return Response(response_serializer.data)

    def destroy(self, request, *args, **kwargs):
        """
        Soft-archive one organisation-scoped client.
        """
        self.archive_service(
            client=self._get_client(self.kwargs[self.lookup_field]),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def proposals(self, request, pk=None):
        """
        Return proposals for this client once the proposals model is implemented.
        """
        return Response(
            {
                "detail": (
                    "Stub only. This endpoint should return the proposals "
                    "belonging to the specified client."
                )
            },
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )

    @action(detail=True, methods=["get"])
    def invoices(self, request, pk=None):
        """
        Return invoices for this client once the invoices model is implemented.
        """
        return Response(
            {
                "detail": (
                    "Stub only. This endpoint should return the invoices "
                    "belonging to the specified client."
                )
            },
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )

    @action(detail=True, methods=["get"])
    def projects(self, request, pk=None):
        """
        Return projects for this client once the projects model is implemented.
        """
        return Response(
            {
                "detail": (
                    "Stub only. This endpoint should return the projects "
                    "belonging to the specified client."
                )
            },
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class LeadViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]
    lookup_value_converter = "uuid"

    list_service = staticmethod(services.list_leads)
    create_service = staticmethod(services.create_lead)
    detail_service = staticmethod(services.get_lead_detail)
    update_service = staticmethod(services.update_lead)
    mark_dead_service = staticmethod(services.mark_lead_dead)

    def get_queryset(self):
        """
        Return the organisation-scoped queryset used by list views and schema tools.
        """
        organisation = getattr(self.request.user, "organisation", None)
        if organisation is None:
            return Lead.objects.none()

        return self.list_service(
            organisation=organisation,
            filters=self.request.query_params,
        )

    def get_serializer_class(self):
        """
        Use serializers by endpoint shape, not by model only.
        """
        if self.action == "list":
            return LeadListSerializer

        if self.action in {"create", "partial_update"}:
            return LeadWriteSerializer

        if self.action == "convert_to_client":
            return ConvertLeadToClientSerializer

        return LeadDetailSerializer

    def _get_lead(self, pk) -> Lead:
        """
        Fetch one lead through the service layer.

        If the lead does not exist inside the authenticated user's
        organisation, the service raises `Lead.DoesNotExist`. The global DRF
        exception handler converts that into a 404, so the view does not need a
        local try/except block.
        """
        return self.detail_service(
            organisation=self.request.user.organisation,
            lead_id=str(pk),
        )

    def list(self, request, *args, **kwargs):
        """
        Return a paginated list of leads for the authenticated organisation.
        """
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = LeadListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = LeadListSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        Create one lead for the authenticated user's organisation.
        """
        serializer = LeadWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        lead = self.create_service(
            organisation=request.user.organisation,
            data=validated_data,
        )

        response_serializer = LeadDetailSerializer(lead)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """
        Partially update one organisation-scoped lead and return the new state.
        """
        serializer = LeadWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        lead = self.update_service(
            lead=self._get_lead(self.kwargs[self.lookup_field]),
            data=validated_data,
        )

        response_serializer = LeadDetailSerializer(lead)
        return Response(response_serializer.data)

    @action(detail=True, methods=["post"], url_path="mark-dead")
    def mark_dead(self, request, *args, **kwargs):
        """
        Mark one organisation-scoped lead as dead.
        """
        lead = self._get_lead(self.kwargs[self.lookup_field])
        updated_lead = self.mark_dead_service(lead=lead)

        response_serializer = LeadDetailSerializer(updated_lead)

        return Response(data=response_serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        """
        Return one organisation-scoped lead detail record.
        """
        lead = self._get_lead(self.kwargs[self.lookup_field])
        serializer = LeadDetailSerializer(lead)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def convert_to_client(self, request, *args, **kwargs) -> Response:
        """
        Convert a lead to a client.

        This is a placeholder for the lead-to-client conversion endpoint. The
        actual implementation will depend on the business rules around lead
        conversion, which may involve creating a new client record, copying
        data from the lead to the client, and possibly deleting or archiving the
        original lead.
        """
        lead = self._get_lead(self.kwargs[self.lookup_field])
        serializer = ConvertLeadToClientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)
        client = services.convert_lead_to_client(
            lead=lead,
            data=validated_data,
        )
        response_serializer = ClientDetailSerializer(client)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
