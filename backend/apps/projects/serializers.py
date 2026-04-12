from rest_framework import serializers

from apps.clients.models import Client
from apps.proposals.models import Proposal
from apps.projects.models import Project


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
    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + [
            "created_at",
            "updated_at",
        ]

class ProjectWriteSerializer(serializers.ModelSerializer):
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        organisation = getattr(getattr(request, "user", None), "organisation", None)

        if organisation is None:
            self.fields["client_id"].queryset = Client.objects.none()
            self.fields["proposal_id"].queryset = Proposal.objects.none()
            return

        self.fields["client_id"].queryset = Client.objects.filter(
            organisation=organisation
        )
        self.fields["proposal_id"].queryset = Proposal.objects.filter(
            organisation=organisation
        )

    def validate_budget(self, value):
        if value <= 0:
            raise serializers.ValidationError("Budget must be positive.")
        return value

    def validate(self, attrs):
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
        ]
