from collections.abc import Mapping
from typing import Any, cast

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.proposals import services
from apps.proposals.models import Proposal
from apps.proposals.serializers import (
    ProposalDetailSerializer,
    ProposalListSerializer,
    ProposalStatusUpdateSerializer,
    ProposalWriteSerializer,
)


class ProposalViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        organisation = getattr(self.request.user, "organisation", None)
        if organisation:
            return services.list_proposals(
                organisation=organisation,
                filters=self.request.query_params
            )

        return Proposal.objects.none()

    def get_serializer_class(self):
        if self.action in ["list"]:
            return ProposalListSerializer
        elif self.action in ["retrieve"]:
            return ProposalDetailSerializer
        elif self.action in ["create", "partial_update"]:
            return ProposalWriteSerializer
        elif self.action == "update_status":
            return ProposalStatusUpdateSerializer
        return super().get_serializer_class()

    def _get_proposal(self, pk: str) -> Proposal:
        return services.get_proposal_detail(
            proposal_id=pk,
            organisation=self.request.user.organisation,
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ProposalListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ProposalListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


    def retrieve(self, request, *args, **kwargs):
        proposal = self._get_proposal(kwargs["pk"])
        serializer = ProposalDetailSerializer(proposal)
        return Response(serializer.data, status=status.HTTP_200_OK)


    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        proposal = services.create_proposal(
            organisation=request.user.organisation,
            data=validated_data
        )
        response_serializer = ProposalDetailSerializer(proposal)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED
        )

    def partial_update(self, request, *args, **kwargs):
        proposal = self._get_proposal(kwargs["pk"])
        serializer = self.get_serializer(
            proposal,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        proposal = services.update_proposal(
            proposal=proposal,
            data=validated_data
        )

        response_serializer = ProposalDetailSerializer(proposal)
        return Response(
            response_serializer.data, status=status.HTTP_200_OK
        )

    def destroy(self, request, *args, **kwargs):
        proposal = self._get_proposal(kwargs["pk"])
        services.delete_proposal(proposal=proposal)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="transition")
    def update_status(self, request, *args, **kwargs):
        proposal = self._get_proposal(kwargs["pk"])
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = services.transition_proposal(
            proposal=proposal,
            new_status=serializer.validated_data["status"],
        )
        return Response(
            ProposalDetailSerializer(proposal).data,
            status=status.HTTP_200_OK
        )
