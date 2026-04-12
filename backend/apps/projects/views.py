from collections.abc import Mapping
from typing import Any, cast

from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from apps.projects import services
from apps.projects.models import Project
from apps.projects.serializers import (
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectWriteSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

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

        return ProjectDetailSerializer

    def _get_project(self, pk: str) -> Project:
        return services.get_project_detail(
            organisation=self.request.user.organisation,
            project_id=str(pk),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ProjectListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ProjectListSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(Mapping[str, Any], serializer.validated_data)

        project = services.create_project(
            organisation=request.user.organisation,
            data=validated_data,
        )

        response_serializer = ProjectDetailSerializer(project)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        project = self._get_project(self.kwargs[self.lookup_field])
        serializer = ProjectDetailSerializer(project)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
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
