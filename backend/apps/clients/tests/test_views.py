import pytest
from django.urls import reverse

from apps.accounts.factories import OrganisationFactory
from apps.clients.factories import ClientFactory, LeadFactory
from apps.clients.models import Client, Lead
from apps.invoices.factories import InvoiceFactory
from apps.projects.factories import ProjectFactory
from apps.proposals.factories import ProposalFactory


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


@pytest.mark.django_db
def test_list_leads_returns_all_own_organisation_leads_by_default(
    authenticated_client,
    org,
):
    own_lead = LeadFactory(organisation=org, name="Own Lead")
    LeadFactory(organisation=OrganisationFactory(), name="Other Org Lead")
    dead_lead = LeadFactory(organisation=org, status=Lead.LeadStatus.DEAD)
    converted_lead = LeadFactory(organisation=org, status=Lead.LeadStatus.CONVERTED)

    response = authenticated_client.get(reverse("lead-list"))

    assert response.status_code == 200
    payload = response.json()
    returned_ids = {item["id"] for item in payload["results"]}
    assert returned_ids == {
        str(own_lead.id),
        str(dead_lead.id),
        str(converted_lead.id),
    }
    assert "organisation" not in payload["results"][0]


@pytest.mark.django_db
def test_list_leads_can_filter_converted_leads(authenticated_client, org):
    LeadFactory(organisation=org, status=Lead.LeadStatus.NEW)
    converted_lead = LeadFactory(organisation=org, status=Lead.LeadStatus.CONVERTED)

    response = authenticated_client.get(
        reverse("lead-list"),
        {"status": Lead.LeadStatus.CONVERTED},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 1
    assert payload["results"][0]["id"] == str(converted_lead.id)


@pytest.mark.django_db
def test_create_lead_succeeds_with_valid_data(authenticated_client, org):
    payload = {
        "name": "Prospect School",
        "contact_person": "Kofi Mensah",
        "email": "prospect@example.com",
        "phone": "0241234567",
        "source": Lead.LeadSource.WEBSITE,
        "status": Lead.LeadStatus.NEW,
        "notes": "Interested in a student portal next term.",
    }

    response = authenticated_client.post(
        reverse("lead-list"),
        payload,
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Prospect School"
    assert response.json()["notes"] == "Interested in a student portal next term."
    assert "organisation" not in response.json()
    assert Lead.objects.filter(
        organisation=org,
        name="Prospect School",
        email="prospect@example.com",
        notes="Interested in a student portal next term.",
    ).exists()


@pytest.mark.django_db
def test_create_lead_rejects_invalid_status(authenticated_client):
    response = authenticated_client.post(
        reverse("lead-list"),
        {
            "name": "Bad Lead",
            "source": Lead.LeadSource.WEBSITE,
            "status": "not-a-real-status",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "status" in response.json()


@pytest.mark.django_db
def test_retrieve_lead_returns_detail_without_organisation(authenticated_client, org):
    lead = LeadFactory(
        organisation=org,
        name="Detail Lead",
        notes="Detail context.",
    )

    response = authenticated_client.get(reverse("lead-detail", kwargs={"pk": lead.id}))

    assert response.status_code == 200
    assert response.json()["id"] == str(lead.id)
    assert response.json()["name"] == "Detail Lead"
    assert response.json()["notes"] == "Detail context."
    assert "organisation" not in response.json()


@pytest.mark.django_db
def test_retrieve_lead_returns_404_for_wrong_organisation(authenticated_client):
    other_lead = LeadFactory()

    response = authenticated_client.get(
        reverse("lead-detail", kwargs={"pk": other_lead.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_partial_update_lead_changes_fields(authenticated_client, org):
    lead = LeadFactory(
        organisation=org,
        name="Old Lead",
        status=Lead.LeadStatus.NEW,
    )

    response = authenticated_client.patch(
        reverse("lead-detail", kwargs={"pk": lead.id}),
        {
            "name": "Updated Lead",
            "status": Lead.LeadStatus.CONTACTED,
        },
        format="json",
    )

    lead.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Lead"
    assert lead.name == "Updated Lead"
    assert lead.status == Lead.LeadStatus.CONTACTED


@pytest.mark.django_db
def test_mark_dead_lead_sets_status_and_returns_updated_lead(authenticated_client, org):
    lead = LeadFactory(organisation=org, status=Lead.LeadStatus.QUALIFIED)

    response = authenticated_client.post(
        reverse("lead-mark-dead", kwargs={"pk": lead.id}),
    )

    lead.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["status"] == Lead.LeadStatus.DEAD
    assert lead.status == Lead.LeadStatus.DEAD


@pytest.mark.django_db
def test_mark_dead_lead_returns_404_for_wrong_organisation(authenticated_client):
    other_lead = LeadFactory()

    response = authenticated_client.post(
        reverse("lead-mark-dead", kwargs={"pk": other_lead.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_lead_method_is_not_allowed(authenticated_client, org):
    lead = LeadFactory(organisation=org)

    response = authenticated_client.delete(
        reverse("lead-detail", kwargs={"pk": lead.id})
    )

    assert response.status_code == 405


@pytest.mark.django_db
def test_client_proposals_endpoint_returns_client_scoped_proposals(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    own_proposal = ProposalFactory(organisation=org, client=client)
    ProposalFactory(organisation=org)
    ProposalFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("client-proposals", kwargs={"pk": client.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(own_proposal.id)
    assert payload[0]["amount"] == "1000.00"


@pytest.mark.django_db
def test_client_proposals_endpoint_returns_404_for_wrong_organisation(
    authenticated_client,
):
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("client-proposals", kwargs={"pk": other_client.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_client_projects_endpoint_returns_client_scoped_projects(
    authenticated_client,
    org,
):
    client = ClientFactory(organisation=org)
    own_project = ProjectFactory(organisation=org, client=client)
    ProjectFactory(organisation=org)
    ProjectFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("client-projects", kwargs={"pk": client.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(own_project.id)
    assert payload[0]["budget"] == "1000.00"


@pytest.mark.django_db
def test_client_projects_endpoint_returns_404_for_wrong_organisation(
    authenticated_client,
):
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("client-projects", kwargs={"pk": other_client.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_client_invoices_endpoint_returns_client_invoices(authenticated_client, org):
    client = ClientFactory(organisation=org)
    own_invoice = InvoiceFactory(organisation=org, client=client)
    InvoiceFactory(organisation=org)

    response = authenticated_client.get(
        reverse("client-invoices", kwargs={"pk": client.id}),
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(own_invoice.id)
    assert payload[0]["total"] == "1000.00"


@pytest.mark.django_db
def test_client_invoices_endpoint_returns_404_for_wrong_organisation(
    authenticated_client,
):
    other_client = ClientFactory(organisation=OrganisationFactory())

    response = authenticated_client.get(
        reverse("client-invoices", kwargs={"pk": other_client.id}),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_convert_lead_to_client_creates_client_and_marks_lead_converted(
    authenticated_client,
    org,
):
    lead = LeadFactory(
        organisation=org,
        name="Convert Me",
        email="lead@example.com",
        status=Lead.LeadStatus.QUALIFIED,
    )

    response = authenticated_client.post(
        reverse("lead-convert-to-client", kwargs={"pk": lead.id}),
        {
            "type": Client.ClientType.SHS,
            "contact_person": "Updated Contact",
            "phone": "0551234567",
            "address": "Accra",
            "region": "Greater Accra",
            "notes": "Ready to onboard.",
        },
        format="json",
    )

    lead.refresh_from_db()
    client = Client.objects.get(id=response.json()["id"])
    assert response.status_code == 200
    assert response.json()["name"] == "Convert Me"
    assert client.organisation == org
    assert client.contact_person == "Updated Contact"
    assert lead.status == Lead.LeadStatus.CONVERTED
    assert lead.converted_to_client == client


@pytest.mark.django_db
def test_convert_lead_to_client_rejects_already_converted_lead(
    authenticated_client,
    org,
):
    existing_client = ClientFactory(organisation=org)
    lead = LeadFactory(
        organisation=org,
        status=Lead.LeadStatus.CONVERTED,
        converted_to_client=existing_client,
    )

    response = authenticated_client.post(
        reverse("lead-convert-to-client", kwargs={"pk": lead.id}),
        {"type": Client.ClientType.SHS},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "This lead has already been converted to a client."
    )
    assert Client.objects.filter(organisation=org).count() == 1


@pytest.mark.django_db
def test_convert_lead_to_client_rejects_invalid_payload(authenticated_client, org):
    lead = LeadFactory(organisation=org)

    response = authenticated_client.post(
        reverse("lead-convert-to-client", kwargs={"pk": lead.id}),
        {"notes": "Missing required client type."},
        format="json",
    )

    assert response.status_code == 400
    assert "type" in response.json()


@pytest.mark.django_db
def test_convert_lead_to_client_returns_404_for_wrong_organisation(
    authenticated_client,
):
    other_lead = LeadFactory()

    response = authenticated_client.post(
        reverse("lead-convert-to-client", kwargs={"pk": other_lead.id}),
        {"type": Client.ClientType.SHS},
        format="json",
    )

    assert response.status_code == 404
