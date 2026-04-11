import pytest
from django.urls import reverse

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory
from apps.clients.models import Client


@pytest.mark.django_db
def test_list_clients_returns_only_own_organisation_clients(authenticated_client, org):
    """
    Tenancy guard: list responses must only include the logged-in user's org.
    """
    # ClientFactory defaults to is_archived=False, matching the list endpoint default.
    own_client = ClientFactory(organisation=org, name="Own Client")
    other_org = OrganisationFactory()
    ClientFactory(organisation=other_org, name="Other Client")

    response = authenticated_client.get(reverse("client-list"))

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(own_client.id)
    assert payload["results"][0]["name"] == "Own Client"


@pytest.mark.django_db
def test_create_client_succeeds_with_valid_data(authenticated_client, org):
    payload = {
        "type": Client.ClientType.SHS,
        "name": "New School",
        "email": "new-school@example.com",
        "contact_person": "Ama Mensah",
        "phone": "0241234567",
        "address": "Accra",
        "region": "Greater Accra",
        "notes": "First contact from referral.",
    }

    response = authenticated_client.post(
        reverse("client-list"),
        payload,
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["name"] == "New School"
    assert Client.objects.filter(
        organisation=org,
        name="New School",
        email="new-school@example.com",
    ).exists()


@pytest.mark.django_db
def test_retrieve_client_returns_404_for_wrong_organisation(authenticated_client):
    other_client = ClientFactory()

    response = authenticated_client.get(
        reverse("client-detail", kwargs={"pk": other_client.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_partial_update_client_changes_fields(authenticated_client, org):
    client = ClientFactory(
        organisation=org,
        name="Old Name",
        contact_person="Old Contact",
    )

    response = authenticated_client.patch(
        reverse("client-detail", kwargs={"pk": client.id}),
        {
            "name": "Updated Name",
            "contact_person": "Updated Contact",
        },
        format="json",
    )

    client.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert client.name == "Updated Name"
    assert client.contact_person == "Updated Contact"


@pytest.mark.django_db
def test_destroy_client_soft_archives(authenticated_client, org):
    client = ClientFactory(organisation=org, is_archived=False)

    response = authenticated_client.delete(
        reverse("client-detail", kwargs={"pk": client.id}),
    )

    client.refresh_from_db()
    assert response.status_code == 204
    assert client.is_archived is True
