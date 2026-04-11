"""
Serializer notes for the clients app.

This file is intentionally only lightly edited because you asked not to have
the final implementation written for you. Where the current design falls short
of typical DRF standards, the guidance is left as comments so you can complete
the refactor yourself.
"""

from rest_framework import serializers

from apps.clients.models import Client


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
            'type',
            'name',
            'email',
            'contact_person',
            'phone',
            'address',
            'region',
            'notes',
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
            'id',
            'type',
            'name',
            'email',
            'contact_person',
            'phone',
            'region',
            'is_archived',
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
            'id',
            'type',
            'name',
            'email',
            'contact_person',
            'phone',
            'address',
            'region',
            'is_archived',
            'notes',
        ]


class ClientProposalListItemSerializer(serializers.Serializer):
    """
    Placeholder serializer for `GET /clients/{id}/proposals/`.

    Use a dedicated serializer here because proposal fields are not client
    fields. Once the `Proposal` model exists, replace this plain `Serializer`
    with a `ModelSerializer` backed by that model.

    Suggested shape to implement later:
    - `id`
    - `title`
    - `status`
    - `amount_ghs`
    - `deadline`
    - `created_at`
    """

    # TODO: Add proposal read-only fields after the Proposal model exists.
    pass


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


class ClientProjectListItemSerializer(serializers.Serializer):
    """
    Placeholder serializer for `GET /clients/{id}/projects/`.

    This should later serialize the minimal Sprint 1 project stub, not the full
    Sprint 2/3 project management surface.

    Suggested shape to implement later:
    - `id`
    - `title`
    - `status`
    - `start_date`
    - `due_date`
    """

    # TODO: Add project read-only fields after the Project model exists.
    pass
