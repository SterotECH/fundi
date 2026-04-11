import factory

from apps.accounts.factories import OrganisationFactory
from apps.clients.models import Client, Lead


class ClientFactory(factory.django.DjangoModelFactory):
    """
    Test factory for clients.

    Use this in endpoint and service tests so each test can focus on the
    behaviour being tested, not on repetitive model setup.
    """

    class Meta:
        model = Client

    organisation = factory.SubFactory(OrganisationFactory)
    type = Client.ClientType.SHS
    name = factory.Sequence(lambda number: f"Client {number}")
    email = factory.Sequence(lambda number: f"client{number}@example.com")
    contact_person = factory.Sequence(lambda number: f"Contact {number}")
    phone = "0240000000"
    address = "Accra"
    region = "Greater Accra"
    notes = ""


class ArchivedClientFactory(ClientFactory):
    """
    Factory for archived clients.

    This is a separate factory to make it easy to create archived clients in
    tests without having to override the `is_archived` field every time.
    """

    is_archived = True


class LeadFactory(factory.django.DjangoModelFactory):
    """
    Factory for leads.

    This is a separate factory to make it easy to create leads in tests without
    having to override the `type` field every time. If you later decide to
    implement lead-specific behaviour, you can add that logic here.
    """

    class Meta:
        model = Lead

    organisation = factory.SubFactory(OrganisationFactory)
    name = factory.Sequence(lambda number: f"Lead {number}")
    contact_person = factory.Sequence(lambda number: f"Lead Contact {number}")
    email = factory.Sequence(lambda number: f"lead{number}@example.com")
    phone = "0240000000"
    source = Lead.LeadSource.REFERRAL
    status = Lead.LeadStatus.NEW
    converted_to_client = None
