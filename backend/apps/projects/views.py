from collections.abc import Mapping
from typing import Any, cast

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import Organisation, User
from apps.projects import services
from apps.projects.models import Milestone, Project, TimeLog
from apps.projects.serializers import (
    MilestoneDetailSerializer,
    MilestoneListSerializer,
    MilestoneWriteSerializer,
    ProjectDetailSerializer,
    ProjectInvoiceListItemSerializer,
    ProjectListSerializer,
    ProjectWriteSerializer,
    TimeLogDetailSerializer,
    TimeLogListSerializer,
    TimeLogWriteSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_converter = "uuid"

    def get_queryset(self):
        organisation = getattr(self.request.user, "organisation", None)
        if organisation is None:
            return Project.objects.none()

        return services.list_projects(
            organisation=organisation,
            filters=self.request.query_params,
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer

        if self.action in {"create", "partial_update"}:
            return ProjectWriteSerializer

        if self.action == "milestones":
            if self.request.method == "POST":
                return MilestoneWriteSerializer
            return MilestoneListSerializer

        if self.action == "milestone_detail":
            return MilestoneWriteSerializer

        if self.action == "invoices":
            return ProjectInvoiceListItemSerializer

        return ProjectDetailSerializer

    def _get_project(self, pk: str) -> Project:
        user = cast(User, self.request.user)
        organisation = cast(Organisation, user.organisation)
        return services.get_project_detail(
            organisation=organisation,
            project_id=str(pk),
        )

    def _get_milestone(self, project_id: str, milestone_id: str) -> Milestone:
        user = cast(User, self.request.user)
        organisation = cast(Organisation, user.organisation)
        return services.get_project_milestone(
            organisation=organisation,
            project_id=project_id,
            milestone_id=milestone_id,
        )

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ProjectListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ProjectListSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)
        user = cast(User, request.user)
        organisation = cast(Organisation, user.organisation)

        project = services.create_project(
            organisation=organisation,
            data=validated_data,
        )

        response_serializer = ProjectDetailSerializer(project)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        project = self._get_project(self.kwargs[self.lookup_field])
        serializer = ProjectDetailSerializer(project)
        return Response(serializer.data)

    def partial_update(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> Response:
        project = self._get_project(self.kwargs[self.lookup_field])
        serializer = self.get_serializer(
            project,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        project = services.update_project(project=project, data=validated_data)

        response_serializer = ProjectDetailSerializer(project)
        return Response(response_serializer.data)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        raise MethodNotAllowed("DELETE")

    @action(detail=True, methods=["get", "post"], url_path="milestones")
    def milestones(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        project = self._get_project(str(kwargs["pk"]))

        if request.method == "GET":
            user = cast(User, request.user)
            organisation = cast(Organisation, user.organisation)
            milestones = services.list_project_milestones(
                organisation=organisation,
                project_id=str(project.id),
            )
            serializer = MilestoneListSerializer(milestones, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        write_serializer = self.get_serializer(
            data={
                **request.data,
                "project_id": str(project.id),
            }
        )
        write_serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], write_serializer.validated_data)
        validated_data = {
            key: value for key, value in validated_data.items() if key != "project"
        }

        milestone = services.create_project_milestone(
            project=project,
            data=validated_data,
        )
        response_serializer = MilestoneDetailSerializer(milestone)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path="milestones/<uuid:milestone_id>",
    )
    def milestone_detail(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> Response:
        project_id = str(kwargs["pk"])
        milestone = self._get_milestone(
            project_id=project_id,
            milestone_id=str(kwargs["milestone_id"]),
        )

        if request.method == "DELETE":
            services.delete_project_milestone(milestone=milestone)
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = self.get_serializer(
            milestone,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)
        validated_data = {
            key: value for key, value in validated_data.items() if key != "project"
        }

        milestone = services.update_project_milestone(
            milestone=milestone,
            data=validated_data,
        )
        response_serializer = MilestoneDetailSerializer(milestone)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="timelogs")
    def timelogs(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        user = cast(User, request.user)
        organisation = cast(Organisation, user.organisation)
        payload = services.list_project_time_logs(
            organisation=organisation,
            project_id=str(kwargs["pk"]),
        )
        queryset = payload["queryset"]
        serializer = TimeLogListSerializer(queryset, many=True)
        return Response(
            {
                "total_hours": f"{payload['total_hours']:.2f}",
                "billable_hours": f"{payload['billable_hours']:.2f}",
                "non_billable_hours": f"{payload['non_billable_hours']:.2f}",
                "effective_rate": f"{payload['effective_rate']:.2f}",
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="invoices")
    def invoices(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        user = cast(User, request.user)
        organisation = cast(Organisation, user.organisation)
        invoices = services.list_project_invoices(
            organisation=organisation,
            project_id=str(kwargs["pk"]),
        )
        serializer = ProjectInvoiceListItemSerializer(invoices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TimeLogViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_converter = "uuid"

    def get_queryset(self):
        organisation = getattr(self.request.user, "organisation", None)
        if organisation is None:
            return TimeLog.objects.none()

        return services.list_time_logs(
            organisation=organisation,
            filters=self.request.query_params,
        )

    def get_serializer_class(self):
        if self.action == "list":
            return TimeLogListSerializer

        if self.action in {"create", "partial_update"}:
            return TimeLogWriteSerializer

        return TimeLogDetailSerializer

    def _get_time_log(self, pk: str) -> TimeLog:
        user = cast(User, self.request.user)
        organisation = cast(Organisation, user.organisation)
        return services.get_time_log_detail(
            organisation=organisation,
            time_log_id=pk,
        )

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = TimeLogListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = TimeLogListSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        time_log = self._get_time_log(str(kwargs["pk"]))
        serializer = TimeLogDetailSerializer(time_log)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)
        user = cast(User, request.user)
        organisation = cast(Organisation, user.organisation)

        time_log = services.create_time_log(
            organisation=organisation,
            user=user,
            data=validated_data,
        )
        response_serializer = TimeLogDetailSerializer(time_log)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> Response:
        time_log = self._get_time_log(str(kwargs["pk"]))
        serializer = self.get_serializer(
            time_log,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        time_log = services.update_time_log(time_log=time_log, data=validated_data)
        response_serializer = TimeLogDetailSerializer(time_log)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        time_log = self._get_time_log(str(kwargs["pk"]))
        services.delete_time_log(time_log=time_log)
        return Response(status=status.HTTP_204_NO_CONTENT)
