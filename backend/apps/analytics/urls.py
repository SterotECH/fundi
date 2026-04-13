from django.urls import path

from apps.analytics.views import (
    AssistantBriefingView,
    AssistantQueryView,
    ClientAnalyticsView,
    InsightsAnalyticsView,
    PipelineAnalyticsView,
    ProjectAnalyticsView,
    RevenueAnalyticsView,
    RevenueSummaryView,
)

urlpatterns = [
    path(
        "assistant/briefing/",
        AssistantBriefingView.as_view(),
        name="assistant-briefing",
    ),
    path(
        "assistant/query/",
        AssistantQueryView.as_view(),
        name="assistant-query",
    ),
    path(
        "analytics/revenue/", RevenueAnalyticsView.as_view(), name="analytics-revenue"
    ),
    path(
        "analytics/revenue/summary/",
        RevenueSummaryView.as_view(),
        name="analytics-revenue-summary",
    ),
    path(
        "analytics/pipeline/",
        PipelineAnalyticsView.as_view(),
        name="analytics-pipeline",
    ),
    path(
        "analytics/clients/",
        ClientAnalyticsView.as_view(),
        name="analytics-clients",
    ),
    path(
        "analytics/projects/",
        ProjectAnalyticsView.as_view(),
        name="analytics-projects",
    ),
    path(
        "analytics/insights/",
        InsightsAnalyticsView.as_view(),
        name="analytics-insights",
    ),
]
