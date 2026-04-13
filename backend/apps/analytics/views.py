"""
API views for Sprint 3 analytics.

We will keep these thin:
- authenticate the request
- pull `request.user.organisation`
- call one service function per endpoint
- serialize the response shape

No business logic belongs here.
"""

from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Organisation, User
from apps.analytics import insights, services
from apps.analytics.serializers import (
    AssistantBriefingSerializer,
    AssistantQueryRequestSerializer,
    AssistantQueryResponseSerializer,
    ClientProfitabilitySerializer,
    InsightSerializer,
    PipelineMetricsSerializer,
    ProjectBudgetBurnSerializer,
    RevenueSeriesSerializer,
    RevenueSummarySerializer,
)


class AnalyticsBaseView(APIView):
    """
    Shared base class for analytics endpoints.

    Responsibility:
    - enforce authentication
    - safely fetch the current user's organisation
    - keep repeated request plumbing out of concrete views

    This is the Django equivalent of a small Laravel base controller helper.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_organisation(self, request: Request) -> Organisation:
        """
        Return the authenticated user's organisation.

        Every analytics query in Fundi must be organisation-scoped. Centralising
        this in one method keeps that rule hard to violate by accident.
        """

        user = request.user
        assert isinstance(user, User)
        organisation = user.organisation
        assert isinstance(organisation, Organisation)
        return organisation


class AssistantQueryView(AnalyticsBaseView):
    """
    Rule-based business assistant endpoint.

    This endpoint validates the request payload, routes the request to one
    supported deterministic intent, and returns a grounded reply. It is
    intentionally narrow: unsupported requests receive an explicit fallback
    response instead of pretending to support open-ended chat.

    Supported intents can include:
    - revenue summary questions
    - overdue invoice summary questions
    - proposal status and deadline summaries
    - client health summaries
    - project budget-risk summaries
    - daily follow-up recommendations
    - proposal follow-up email drafting
    """

    def post(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        serializer = AssistantQueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = services.resolve_assistant_query(
            organisation=organisation,
            data=serializer.validated_data,
        )
        response_serializer = AssistantQueryResponseSerializer(payload)
        return Response(response_serializer.data)


class AssistantBriefingView(AnalyticsBaseView):
    """
    Return the deterministic daily briefing for the current organisation.

    This is the API surface for the same briefing payload the Celery task
    builds in the background, which keeps the assistant panel and scheduled
    delivery logic on one shared contract.
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        payload = services.build_daily_briefing(organisation=organisation)
        serializer = AssistantBriefingSerializer(payload)
        return Response(serializer.data)


class RevenueAnalyticsView(AnalyticsBaseView):
    """
    Return the monthly revenue series used by the analytics chart.

    The view reads the optional `months` query parameter, delegates aggregation
    to the service layer, and returns the serializer-defined response shape.
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        months = int(request.query_params.get("months", 12))
        payload = services.get_revenue_series(organisation=organisation, months=months)
        serializer = RevenueSeriesSerializer(payload)
        return Response(serializer.data)


class RevenueSummaryView(AnalyticsBaseView):
    """
    Return the compact revenue summary for dashboard KPI tiles.

    This view exists separately from the series endpoint because dashboard tiles
    and charts usually need different payload shapes.
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        payload = services.get_revenue_summary(organisation=organisation)
        serializer = RevenueSummarySerializer(payload)
        return Response(serializer.data)


class PipelineAnalyticsView(AnalyticsBaseView):
    """
    Return proposal funnel and conversion metrics.

    The service layer will calculate:
    - counts and value by proposal status
    - win rate from decided proposals only
    - average deal value
    - average days to close
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        payload = services.get_pipeline_metrics(organisation=organisation)
        serializer = PipelineMetricsSerializer(payload)
        return Response(serializer.data)


class ClientAnalyticsView(AnalyticsBaseView):
    """
    Return profitability metrics per client.

    Supports the `sort_by` query parameter so the frontend can request rows
    ordered by revenue, hours, or effective rate without changing the endpoint
    contract.
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        sort_by = request.query_params.get("sort_by", "revenue")
        payload = services.get_client_profitability(
            organisation=organisation,
            sort_by=sort_by,
        )
        serializer = ClientProfitabilitySerializer(payload, many=True)
        return Response(serializer.data)


class ProjectAnalyticsView(AnalyticsBaseView):
    """
    Return project budget-burn metrics.

    This endpoint translates project finances and time logs into an operational
    view of burn percentage and budget risk.
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        payload = services.get_project_budget_burn(organisation=organisation)
        serializer = ProjectBudgetBurnSerializer(payload, many=True)
        return Response(serializer.data)


class InsightsAnalyticsView(AnalyticsBaseView):
    """
    Return rule-based insights derived from analytics data.

    This endpoint does not calculate raw metrics itself. It delegates to the
    insight layer, which reads deterministic service outputs and converts them
    into business observations.
    """

    def get(self, request: Request) -> Response:
        organisation = self.get_organisation(request)
        payload = insights.build_insights(organisation=organisation)
        serializer = InsightSerializer(payload, many=True)
        return Response(serializer.data)
