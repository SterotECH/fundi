from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Organisation, User
from apps.core import services
from apps.core.models import Notification
from apps.core.serializers import (
    NotificationDetailSerializer,
    NotificationListSerializer,
    NotificationMarkReadSerializer,
)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]
    lookup_value_converter = "uuid"

    def get_queryset(self):
        user = self.request.user
        if not isinstance(user, User):
            return Notification.objects.none()

        payload = services.list_notifications(
            user=user,
            filters=self.request.query_params,
        )
        return payload["queryset"]

    def get_serializer_class(self):
        if self.action in {"read", "read_all"}:
            return NotificationMarkReadSerializer

        if self.action == "list":
            return NotificationListSerializer

        return NotificationDetailSerializer

    def _get_notification(self, pk: str) -> Notification:
        user = self.request.user
        assert isinstance(user, User)
        return services.get_notification_detail(
            user=user,
            notification_id=pk,
        )

    def list(self, request: Request, *args, **kwargs) -> Response:
        user = request.user
        assert isinstance(user, User)
        payload = services.list_notifications(
            user=user,
            filters=request.query_params,
        )
        queryset = payload["queryset"]
        unread_count = payload["unread_count"]
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = NotificationListSerializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["unread_count"] = unread_count
            return response

        serializer = NotificationListSerializer(queryset, many=True)
        return Response(
            {
                "count": queryset.count(),
                "unread_count": unread_count,
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request: Request, *args, **kwargs) -> Response:
        notification = self._get_notification(str(kwargs["pk"]))
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification = services.mark_notification_read(notification=notification)
        response_serializer = NotificationDetailSerializer(notification)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request: Request, *args, **kwargs) -> Response:
        user = request.user
        assert isinstance(user, User)
        services.mark_all_notifications_read(user=user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = request.user
        assert isinstance(user, User)
        organisation = user.organisation
        assert isinstance(organisation, Organisation)
        payload = services.get_dashboard_summary(
            organisation=organisation,
        )
        return Response(payload)
