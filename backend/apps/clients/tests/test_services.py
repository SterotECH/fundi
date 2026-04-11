import pytest

from apps.accounts.factories import OrganisationFactory
from apps.clients import services
from apps.clients.factories import ClientFactory
from apps.clients.models import Client


@pytest.mark.django_db
def test_list_clients_defaults_to_active_clients_for_one_organisation(org):
    active_client = ClientFactory(organisation=org, name="Active Client")
    ClientFactory(organisation=org, name="Archived Client", is_archived=True)
    ClientFactory(organisation=OrganisationFactory(), name="Other Org Client")

    queryset = services.list_clients(organisation=org, filters={})

    assert list(queryset) == [active_client]


@pytest.mark.django_db
def test_list_clients_can_filter_archived_clients(org):
    ClientFactory(organisation=org, name="Active Client", is_archived=False)
    archived_client = ClientFactory(
        organisation=org,
        name="Archived Client",
        is_archived=True,
    )

    queryset = services.list_clients(
        organisation=org,
        filters={"is_archived": "true"},
    )

    assert list(queryset) == [archived_client]


@pytest.mark.django_db
def test_list_clients_searches_name_email_and_contact_person(org):
    name_match = ClientFactory(organisation=org, name="Alpha School")
    email_match = ClientFactory(organisation=org, email="alpha@example.com")
    contact_match = ClientFactory(organisation=org, contact_person="Alpha Lead")
    ClientFactory(organisation=org, name="Beta School")

    queryset = services.list_clients(organisation=org, filters={"search": "alpha"})

    assert {client.id for client in queryset} == {
        name_match.id,
        email_match.id,
        contact_match.id,
    }


@pytest.mark.django_db
def test_list_clients_filters_by_type(org):
    shs_client = ClientFactory(organisation=org, type=Client.ClientType.SHS)
    ClientFactory(organisation=org, type=Client.ClientType.UNI)

    queryset = services.list_clients(
        organisation=org,
        filters={"type": Client.ClientType.SHS},
    )

    assert list(queryset) == [shs_client]


@pytest.mark.django_db
def test_create_client_attaches_server_side_organisation(org):
    client = services.create_client(
        organisation=org,
        data={
            "type": Client.ClientType.SHS,
            "name": "Created Client",
            "email": "created@example.com",
            "contact_person": "Created Contact",
            "phone": "0240000000",
            "address": "Accra",
            "region": "Greater Accra",
            "notes": "Created through service.",
        },
    )

    assert client.organisation == org
    assert client.name == "Created Client"


@pytest.mark.django_db
def test_get_client_detail_returns_client_inside_organisation(org):
    client = ClientFactory(organisation=org)

    result = services.get_client_detail(
        organisation=org,
        client_id=str(client.id),
    )

    assert result == client


@pytest.mark.django_db
def test_get_client_detail_raises_for_wrong_organisation(org):
    client = ClientFactory(organisation=OrganisationFactory())

    with pytest.raises(Client.DoesNotExist):
        services.get_client_detail(
            organisation=org,
            client_id=str(client.id),
        )


@pytest.mark.django_db
def test_update_client_mutates_existing_instance_without_refetching(
    django_assert_num_queries,
    org,
):
    client = ClientFactory(organisation=org, name="Old Name")

    with django_assert_num_queries(1):
        result = services.update_client(
            client=client,
            data={"name": "New Name", "region": "Ashanti"},
        )

    client.refresh_from_db()
    assert result == client
    assert client.name == "New Name"
    assert client.region == "Ashanti"


@pytest.mark.django_db
def test_archive_client_soft_archives_existing_instance(django_assert_num_queries, org):
    client = ClientFactory(organisation=org, is_archived=False)

    with django_assert_num_queries(1):
        result = services.archive_client(client=client)

    client.refresh_from_db()
    assert result == client
    assert client.is_archived is True


@pytest.mark.django_db
def test_related_client_services_are_intentional_stubs(org):
    client_id = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(NotImplementedError):
        services.list_client_proposals(organisation=org, client_id=client_id)

    with pytest.raises(NotImplementedError):
        services.list_client_invoices(organisation=org, client_id=client_id)

    with pytest.raises(NotImplementedError):
        services.list_client_projects(organisation=org, client_id=client_id)
