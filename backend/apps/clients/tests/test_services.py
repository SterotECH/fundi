import pytest

from apps.accounts.factories import OrganisationFactory
from apps.clients import services
from apps.clients.exceptions import LeadAlreadyConvertedError
from apps.clients.factories import ClientFactory, LeadFactory
from apps.clients.models import Client, Lead
from apps.projects.factories import ProjectFactory
from apps.proposals.factories import ProposalFactory


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
def test_update_client_mutates_existing_instance(org):
    client = ClientFactory(organisation=org, name="Old Name")

    result = services.update_client(
        client=client,
        data={"name": "New Name", "region": "Ashanti"},
    )

    client.refresh_from_db()
    assert result == client
    assert client.name == "New Name"
    assert client.region == "Ashanti"


@pytest.mark.django_db
def test_archive_client_soft_archives_existing_instance(org):
    client = ClientFactory(organisation=org, is_archived=False)

    result = services.archive_client(client=client)

    client.refresh_from_db()
    assert result == client
    assert client.is_archived is True


@pytest.mark.django_db
def test_convert_lead_to_client_creates_client_and_marks_lead_converted(org):
    lead = LeadFactory(
        organisation=org,
        name="Stero Lead",
        email="lead@example.com",
        contact_person="Original Contact",
        phone="0240000000",
        source=Lead.LeadSource.WEBSITE,
        status=Lead.LeadStatus.QUALIFIED,
    )

    client = services.convert_lead_to_client(
        lead=lead,
        data={
            "type": Client.ClientType.SHS,
            "contact_person": "Updated Contact",
            "phone": "0550000000",
            "address": "Accra",
            "region": "Greater Accra",
            "notes": "Ready for onboarding.",
        },
    )

    lead.refresh_from_db()
    assert client.organisation == org
    assert client.name == "Stero Lead"
    assert client.email == "lead@example.com"
    assert client.contact_person == "Updated Contact"
    assert client.phone == "0550000000"
    assert client.address == "Accra"
    assert client.region == "Greater Accra"
    assert "Ready for onboarding." in client.notes
    assert lead.status == Lead.LeadStatus.CONVERTED
    assert lead.converted_to_client == client


@pytest.mark.django_db
def test_convert_lead_to_client_rejects_already_converted_lead(org):
    existing_client = ClientFactory(organisation=org)
    lead = LeadFactory(
        organisation=org,
        status=Lead.LeadStatus.CONVERTED,
        converted_to_client=existing_client,
    )

    with pytest.raises(LeadAlreadyConvertedError):
        services.convert_lead_to_client(
            lead=lead,
            data={"type": Client.ClientType.UNI},
        )

    assert Client.objects.filter(organisation=org).count() == 1


@pytest.mark.django_db
def test_list_leads_excludes_converted_by_default_but_allows_status_filter(org):
    active_lead = LeadFactory(organisation=org, status=Lead.LeadStatus.NEW)
    converted_lead = LeadFactory(organisation=org, status=Lead.LeadStatus.CONVERTED)

    default_queryset = services.list_leads(organisation=org, filters={})
    converted_queryset = services.list_leads(
        organisation=org,
        filters={"status": Lead.LeadStatus.CONVERTED},
    )

    assert list(default_queryset) == [active_lead]
    assert list(converted_queryset) == [converted_lead]


@pytest.mark.django_db
def test_list_client_proposals_is_client_and_organisation_scoped(org):
    client = ClientFactory(organisation=org)
    own_proposal = ProposalFactory(organisation=org, client=client)
    ProposalFactory(organisation=org)
    ProposalFactory(organisation=OrganisationFactory())

    queryset = services.list_client_proposals(
        organisation=org,
        client_id=str(client.id),
    )

    assert list(queryset) == [own_proposal]


@pytest.mark.django_db
def test_list_client_proposals_raises_for_wrong_organisation_client(org):
    other_client = ClientFactory(organisation=OrganisationFactory())

    with pytest.raises(Client.DoesNotExist):
        services.list_client_proposals(
            organisation=org,
            client_id=str(other_client.id),
        )


@pytest.mark.django_db
def test_list_client_projects_is_client_and_organisation_scoped(org):
    client = ClientFactory(organisation=org)
    own_project = ProjectFactory(organisation=org, client=client)
    ProjectFactory(organisation=org)
    ProjectFactory(organisation=OrganisationFactory())

    queryset = services.list_client_projects(
        organisation=org,
        client_id=str(client.id),
    )

    assert list(queryset) == [own_project]


@pytest.mark.django_db
def test_list_client_projects_raises_for_wrong_organisation_client(org):
    other_client = ClientFactory(organisation=OrganisationFactory())

    with pytest.raises(Client.DoesNotExist):
        services.list_client_projects(
            organisation=org,
            client_id=str(other_client.id),
        )


@pytest.mark.django_db
def test_list_client_invoices_remains_sprint_2_stub(org):
    with pytest.raises(NotImplementedError):
        services.list_client_invoices(
            organisation=org,
            client_id="00000000-0000-0000-0000-000000000000",
        )
