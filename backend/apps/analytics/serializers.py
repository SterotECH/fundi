"""
Serializer layer for Sprint 3 analytics responses.

Analytics endpoints are read-only summary endpoints, so these serializers are mainly
output contracts rather than model serializers.
"""

from rest_framework import serializers


class AssistantContextSerializer(serializers.Serializer):
    """
    Optional identifiers that help the rule engine answer a request.

    Example:
    - `proposal_id` when drafting a follow-up email
    - `invoice_id` when summarising an overdue balance
    """

    proposal_id = serializers.UUIDField(required=False)
    invoice_id = serializers.UUIDField(required=False)
    client_id = serializers.UUIDField(required=False)
    project_id = serializers.UUIDField(required=False)


class AssistantQueryRequestSerializer(serializers.Serializer):
    """
    Input contract for the rule-based assistant endpoint.

    `message` is the user's natural-language request.
    `context` is optional structured help so the backend does not have to guess
    which proposal, invoice, or client the user is referring to.
    """

    message = serializers.CharField()
    conversation_history = serializers.ListField(required=False)
    context = AssistantContextSerializer(required=False)


class AssistantDraftSerializer(serializers.Serializer):
    """
    Structured email draft payload.

    This lets the frontend show drafts in a UI richer than plain text when the
    matched rule returns an email response.
    """

    subject = serializers.CharField()
    body = serializers.CharField()
    template_key = serializers.CharField()


class AssistantItemSerializer(serializers.Serializer):
    """
    One structured assistant recommendation item.

    This supports richer UIs than a plain reply string when the assistant needs
    to rank work by urgency.
    """

    type = serializers.CharField()
    label = serializers.CharField()
    reason = serializers.CharField()
    entity_type = serializers.CharField(required=False, allow_blank=True)
    entity_id = serializers.UUIDField(required=False)
    priority = serializers.IntegerField()


class AssistantQueryResponseSerializer(serializers.Serializer):
    """
    Output contract for deterministic assistant responses.

    `reply` is the main user-facing text.
    `matched_rule` explains which rule handled the request.
    `draft` is optional and appears when the rule returns a structured email draft.
    """

    reply = serializers.CharField()
    matched_rule = serializers.CharField()
    data_context_used = serializers.CharField(required=False, allow_blank=True)
    draft = AssistantDraftSerializer(required=False)
    items = AssistantItemSerializer(many=True, required=False)


class RevenuePointSerializer(serializers.Serializer):
    """
    One point on the revenue time series chart.

    This serializer defines the exact shape the frontend should expect for each
    month in the chart.
    """

    month = serializers.CharField()
    collected_ghs = serializers.CharField()
    invoiced_ghs = serializers.CharField()


class RevenueSeriesSerializer(serializers.Serializer):
    """
    Full revenue chart payload.

    The service method will return monthly points plus top-level summary numbers
    that the frontend can display next to the chart without another API call.
    """

    months = RevenuePointSerializer(many=True)
    total_collected = serializers.CharField()
    total_outstanding = serializers.CharField()


class RevenueSummarySerializer(serializers.Serializer):
    """
    Dashboard-friendly revenue summary.

    This is intentionally flatter than `RevenueSeriesSerializer` because tile
    layouts work best with direct fields.
    """

    this_month_collected = serializers.CharField()
    last_month_collected = serializers.CharField()
    mom_change_pct = serializers.FloatField()
    ytd_collected = serializers.CharField()
    total_outstanding = serializers.CharField()
    overdue_count = serializers.IntegerField()
    overdue_total = serializers.CharField()


class PipelineStatusSerializer(serializers.Serializer):
    """
    One row of proposal funnel data.

    Each item represents a proposal status bucket, for example `draft`, `sent`,
    `negotiating`, `won`, or `lost`.
    """

    status = serializers.CharField()
    count = serializers.IntegerField()
    total_value_ghs = serializers.CharField()


class PipelineMetricsSerializer(serializers.Serializer):
    """
    Full proposal pipeline payload.

    This is the read-only equivalent of a Laravel API resource for aggregated
    funnel data.
    """

    by_status = PipelineStatusSerializer(many=True)
    win_rate_pct = serializers.FloatField()
    avg_deal_value_ghs = serializers.CharField()
    avg_days_to_close = serializers.FloatField()
    total_pipeline_value_ghs = serializers.CharField()


class ClientProfitabilitySerializer(serializers.Serializer):
    """
    Per-client profitability row.

    The frontend profitability table should render directly from this contract.
    """

    client_id = serializers.UUIDField()
    client_name = serializers.CharField()
    invoiced_ghs = serializers.CharField()
    collected_ghs = serializers.CharField()
    outstanding_ghs = serializers.CharField()
    total_hours = serializers.FloatField()
    billable_hours = serializers.FloatField()
    effective_rate_ghs = serializers.CharField()
    open_proposals = serializers.IntegerField()


class ProjectBudgetBurnSerializer(serializers.Serializer):
    """
    Per-project budget and burn row.

    This serializer helps the frontend show which projects are burning too much
    budget relative to logged hours and collected revenue.
    """

    project_id = serializers.UUIDField()
    title = serializers.CharField()
    client_name = serializers.CharField()
    budget_ghs = serializers.CharField()
    invoiced_ghs = serializers.CharField()
    collected_ghs = serializers.CharField()
    total_hours = serializers.FloatField()
    billable_hours = serializers.FloatField()
    burn_pct = serializers.FloatField()
    status = serializers.CharField()


class InsightSerializer(serializers.Serializer):
    """
    One rule-based business observation.

    This contract is intentionally generic so multiple rule types can share one
    endpoint and one frontend card component.
    """

    type = serializers.CharField()
    severity = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    entity_type = serializers.CharField(required=False, allow_blank=True)
    entity_id = serializers.UUIDField(required=False)
    value = serializers.CharField(required=False, allow_blank=True)


class AssistantBriefingSerializer(serializers.Serializer):
    """
    Daily briefing payload for the assistant panel.

    This wraps the top-level headline plus the existing structured analytics and
    recommendation payloads that power the briefing UI.
    """

    headline = serializers.CharField()
    revenue_summary = RevenueSummarySerializer()
    follow_up = AssistantQueryResponseSerializer()
    insights = InsightSerializer(many=True)
