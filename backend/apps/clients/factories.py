import factory

from apps.accounts.factories import OrganisationFactory
from apps.clients.models import Client


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
