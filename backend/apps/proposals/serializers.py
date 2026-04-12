from django.utils import timezone
from rest_framework import serializers

from apps.clients.models import Client
from apps.proposals.models import Proposal


class ProposalListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proposal
        fields = [
            "id",
            "title",
            "client",
            "description",
            "sent_date",
            "deadline",
            "decision_date",
            "status",
            "amount",
            "notes",
        ]


class ProposalWriteSerializer(serializers.ModelSerializer):
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source="client",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        organisation = getattr(getattr(request, "user", None), "organisation", None)
        if organisation is not None:
            self.fields["client_id"].queryset = Client.objects.filter(
                organisation=organisation
            )
        else:
            self.fields["client_id"].queryset = Client.objects.none()

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

    def validate_deadline(self, value):
        if self.instance is None and value < timezone.localdate():
            raise serializers.ValidationError("Deadline cannot be in the past.")
        return value

    class Meta:
        model = Proposal
        fields = [
            "client_id",
            "title",
            "description",
            "deadline",
            "amount",
            "notes",
        ]


class ProposalDetailSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Proposal
        fields = [
            "id",
            "title",
            "client",
            "client_name",
            "description",
            "sent_date",
            "deadline",
            "decision_date",
            "status",
            "amount",
            "notes",
        ]


class ProposalStatusUpdateSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(choices=Proposal.ProposalStatus.choices)

    class Meta:
        model = Proposal
        fields = ["status"]


class ProposalConvertSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    start_date = serializers.DateField()
    due_date = serializers.DateField()

    def validate(self, attrs):
        if attrs["due_date"] < attrs["start_date"]:
            raise serializers.ValidationError(
                {"due_date": "Due date cannot be before start date."}
            )
        return attrs
