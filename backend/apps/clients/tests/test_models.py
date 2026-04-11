import pytest

from apps.clients.factories import ClientFactory


@pytest.mark.django_db
def test_client_string_returns_name():
    client = ClientFactory(name="Stero Academy")

    assert str(client) == "Stero Academy"
