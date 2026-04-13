from decimal import Decimal
from typing import Any, cast

from rest_framework import serializers

from apps.clients.models import Client
from apps.invoices.models import Invoice
from apps.projects import services
from apps.projects.models import Milestone, Project, TimeLog
from apps.proposals.models import Proposal


class ProjectListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    proposal_title = serializers.CharField(source="proposal.title", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "description",
            "status",
            "start_date",
            "due_date",
            "budget",
            "client",
            "client_name",
            "proposal",
            "proposal_title",
        ]


class ProjectDetailSerializer(ProjectListSerializer):
    milestones = serializers.SerializerMethodField()
    time_summary = serializers.SerializerMethodField()

    def get_milestones(self, obj: Project) -> Any:
        milestones = obj.milestones.order_by("order", "due_date", "-created_at")
        return MilestoneListSerializer(milestones, many=True).data

    def get_time_summary(self, obj: Project) -> dict[str, str]:
        payload = {
            "total_hours": Decimal("0.00"),
            "billable_hours": Decimal("0.00"),
            "non_billable_hours": Decimal("0.00"),
            "effective_rate": Decimal("0.00"),
        }
        if obj.organisation_id:
            payload = services.list_project_time_logs(
                organisation=obj.organisation,
                project_id=str(obj.id),
            )

        return {
            "total_hours": f"{payload['total_hours']:.2f}",
            "billable_hours": f"{payload['billable_hours']:.2f}",
            "non_billable_hours": f"{payload['non_billable_hours']:.2f}",
            "effective_rate": f"{payload['effective_rate']:.2f}",
        }

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + [
            "milestones",
            "time_summary",
            "created_at",
            "updated_at",
        ]


class ProjectCreateMilestoneSerializer(serializers.Serializer):
    title = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateField()
    completed = serializers.BooleanField(required=False, default=False)
    order = serializers.IntegerField(min_value=0)


class ProjectWriteSerializer(serializers.ModelSerializer):
    milestones = ProjectCreateMilestoneSerializer(
        many=True, required=False, write_only=True
    )
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source="client",
    )
    proposal_id = serializers.PrimaryKeyRelatedField(
        queryset=Proposal.objects.all(),
        source="proposal",
        required=False,
        allow_null=True,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        organisation = getattr(getattr(request, "user", None), "organisation", None)
        client_id = cast(serializers.PrimaryKeyRelatedField, self.fields["client_id"])
        proposal_id = cast(
            serializers.PrimaryKeyRelatedField,
            self.fields["proposal_id"],
        )

        if organisation is None:
            client_id.queryset = Client.objects.none()
            proposal_id.queryset = Proposal.objects.none()
            return

        client_id.queryset = Client.objects.filter(organisation=organisation)
        proposal_id.queryset = Proposal.objects.filter(organisation=organisation)

    def validate_budget(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Budget must be positive.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        due_date = attrs.get(
            "due_date",
            getattr(self.instance, "due_date", None),
        )
        if start_date and due_date and due_date < start_date:
            raise serializers.ValidationError(
                {"due_date": "Due date cannot be before start date."}
            )

        milestones = attrs.get("milestones", [])
        if milestones and self.instance is not None:
            raise serializers.ValidationError(
                {
                    "milestones": "Milestones can only be supplied when creating a project."
                }
            )

        return attrs

    class Meta:
        model = Project
        fields = [
            "title",
            "description",
            "status",
            "start_date",
            "due_date",
            "budget",
            "client_id",
            "proposal_id",
            "milestones",
        ]


class MilestoneListSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source="project.title", read_only=True)
    completed = serializers.BooleanField(source="is_completed", read_only=True)

    class Meta:
        model = Milestone
        fields = [
            "id",
            "project",
            "project_title",
            "title",
            "description",
            "due_date",
            "completed",
            "completed_at",
            "order",
        ]


class MilestoneDetailSerializer(MilestoneListSerializer):
    class Meta(MilestoneListSerializer.Meta):
        fields = MilestoneListSerializer.Meta.fields + [
            "created_at",
            "updated_at",
        ]


class MilestoneWriteSerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
    )
    completed = serializers.BooleanField(
        source="is_completed",
        required=False,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        organisation = getattr(getattr(request, "user", None), "organisation", None)
        project_id = cast(serializers.PrimaryKeyRelatedField, self.fields["project_id"])

        if organisation is None:
            project_id.queryset = Project.objects.none()
            return

        project_id.queryset = Project.objects.filter(organisation=organisation)

    class Meta:
        model = Milestone
        fields = [
            "project_id",
            "title",
            "description",
            "due_date",
            "completed",
            "order",
        ]


class TimeLogListSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source="project.title", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    billable = serializers.BooleanField(source="is_billable", read_only=True)

    class Meta:
        model = TimeLog
        fields = [
            "id",
            "project",
            "project_title",
            "user",
            "user_name",
            "log_date",
            "hours",
            "description",
            "billable",
            "created_at",
        ]


class TimeLogDetailSerializer(TimeLogListSerializer):
    class Meta(TimeLogListSerializer.Meta):
        fields = TimeLogListSerializer.Meta.fields + [
            "updated_at",
        ]


class TimeLogWriteSerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
    )
    billable = serializers.BooleanField(
        source="is_billable",
        required=False,
    )

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        organisation = getattr(getattr(request, "user", None), "organisation", None)
        project_id = cast(serializers.PrimaryKeyRelatedField, self.fields["project_id"])

        if organisation is None:
            project_id.queryset = Project.objects.none()
            return

        project_id.queryset = Project.objects.filter(organisation=organisation)

    def validate_hours(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Hours must be positive.")
        return value

    class Meta:
        model = TimeLog
        fields = [
            "project_id",
            "log_date",
            "hours",
            "description",
            "billable",
        ]


class ProjectInvoiceListItemSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "client",
            "client_name",
            "status",
            "issue_date",
            "due_date",
            "subtotal",
            "tax",
            "total",
            "created_at",
        ]
