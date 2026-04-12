"""
Serializer notes for the clients app.

This file is intentionally only lightly edited because you asked not to have
the final implementation written for you. Where the current design falls short
of typical DRF standards, the guidance is left as comments so you can complete
the refactor yourself.
"""

from rest_framework import serializers

from apps.clients.models import Client, Lead
from apps.projects.models import Project
from apps.proposals.models import Proposal


class ClientWriteSerializer(serializers.ModelSerializer):
    """
    Write serializer for create/update operations.

    Only include fields the API consumer is allowed to submit.
    `organisation` must not be writable from the request body because tenant
    ownership comes from `request.user.organisation`.
    """

    type = serializers.ChoiceField(choices=Client.ClientType.choices)

    class Meta:
        model = Client
        fields = [
            "type",
            "name",
            "email",
            "contact_person",
            "phone",
            "address",
            "region",
            "notes",
        ]


class ClientListSerializer(serializers.ModelSerializer):
    """
    Read serializer for `GET /clients/`.

    Keep this one intentionally slim because list endpoints are paginated and
    executed over many rows. Do not dump nested related data here unless the UI
    genuinely needs it for the table/card view.
    """

    class Meta:
        model = Client
        fields = [
            "id",
            "type",
            "name",
            "email",
            "contact_person",
            "phone",
            "region",
            "is_archived",
        ]


class ClientDetailSerializer(serializers.ModelSerializer):
    """
    Read serializer for `GET /clients/{id}/`.

    This is where you add manifesto-style summary fields because the detail page
    needs richer information than the list page.

    What you should add when you implement it:
    - read-only integer fields for `proposals_count`, `projects_count`,
      `invoices_count`, and later `payments_count` if needed
    - read-only money summary fields such as `total_invoiced`,
      `total_collected`, and `outstanding_balance` once invoice/payment models
      exist
    - optional nested arrays only if the detail endpoint is designed to return
      them directly; otherwise keep nested data in the dedicated sub-endpoints

    Important:
    - `organisation` is omitted here by default because the frontend usually
      does not need tenant ownership echoed back
    - if you later decide to expose it, make it explicitly read-only
    """

    class Meta:
        model = Client
        fields = [
            "id",
            "type",
            "name",
            "email",
            "contact_person",
            "phone",
            "address",
            "region",
            "is_archived",
            "notes",
        ]


class ClientProposalListItemSerializer(serializers.ModelSerializer):
    """
    Minimal proposal row for the client detail proposal tab.
    """

    class Meta:
        model = Proposal
        fields = [
            "id",
            "title",
            "status",
            "amount",
            "deadline",
            "created_at",
        ]


class ClientInvoiceListItemSerializer(serializers.Serializer):
    """
    Placeholder serializer for `GET /clients/{id}/invoices/`.

    This should become a dedicated invoice serializer later because invoice data
    has its own business language and formatting rules.

    Suggested shape to implement later:
    - `id`
    - `invoice_number`
    - `status`
    - `issue_date`
    - `due_date`
    - `total_amount`
    - `outstanding_amount`
    """

    # TODO: Add invoice read-only fields after the Invoice model exists.
    pass


class ClientProjectListItemSerializer(serializers.ModelSerializer):
    """
    Placeholder serializer for `GET /clients/{id}/projects/`.

    Minimal project row for the client detail project tab.
    """

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "status",
            "start_date",
            "due_date",
            "budget",
        ]


class LeadWriteSerializer(serializers.ModelSerializer):
    """
    Write serializer for creating/updating leads.

    This is a separate serializer from the LeadSerializer because some fields
    (like `converted_to_client`) should not be writable from the request body.
    """

    source = serializers.ChoiceField(choices=Lead.LeadSource.choices)
    status = serializers.ChoiceField(choices=Lead.LeadStatus.choices)

    class Meta:
        model = Lead
        fields = [
            "name",
            "contact_person",
            "email",
            "phone",
            "source",
            "status",
            "notes",
        ]


class LeadListSerializer(serializers.ModelSerializer):
    """
    Read serializer for listing leads.

    This is a separate serializer from the LeadSerializer because list endpoints
    should be optimized for performance and may not need all the fields that the
    detail serializer provides.
    """

    class Meta:
        model = Lead
        fields = [
            "id",
            "name",
            "contact_person",
            "email",
            "phone",
            "source",
            "status",
            "notes",
        ]


class LeadDetailSerializer(serializers.ModelSerializer):
    """
    Read serializer for lead details.
    """

    class Meta:
        model = Lead
        fields = [
            "id",
            "name",
            "contact_person",
            "email",
            "phone",
            "source",
            "status",
            "notes",
            "converted_to_client",
        ]
        read_only_fields = ["converted_to_client", "id"]


class ConvertLeadToClientSerializer(serializers.Serializer):
    """
    Serializer for converting a lead to a client.

    This is not a ModelSerializer because it does not directly correspond to a
    single model. Instead, it represents the data needed to perform the
    conversion action, which may involve creating a new Client instance based on
    the Lead data.
    """

    type = serializers.ChoiceField(choices=Client.ClientType.choices)
    contact_person = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    region = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(allow_blank=True, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
