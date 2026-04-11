import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.factories import OrganisationFactory, UserFactory


@pytest.fixture
def org():
    """
    Shared organisation fixture.

    Pytest loads `conftest.py` automatically for tests under this directory.
    That means every app test can ask for `org` without importing it manually.
    """
    return OrganisationFactory()


@pytest.fixture
def user(org):
    """
    Shared user fixture for the default organisation.
    """
    return UserFactory(organisation=org)


@pytest.fixture
def authenticated_client(user):
    """
    DRF API client with a valid JWT access token already attached.

    This is the test equivalent of a logged-in browser/API consumer. View tests
    should use this fixture instead of repeating token creation in every file.
    """
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client
