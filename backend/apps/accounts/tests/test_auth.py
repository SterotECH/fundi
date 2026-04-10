# apps/accounts/tests/test_auth.py
import pytest
from django.urls import reverse
from apps.accounts.models import Organisation, User


@pytest.fixture
def org():
    # create and return an Organisation instance
    return Organisation.objects.create(
        name='Test Org',
        slug='test-org',
        currency='GHS',
        country='GH',
        subscription_plan='free'
    )

@pytest.fixture
def user(org):
    # create and return a User with a known password
    # hint: use User.objects.create_user(), not create()
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword',
        full_name='Test User',
        organisation=org
    )

@pytest.mark.django_db
def test_login_returns_access_token(client, user):
    url = reverse('auth-login')
    response = client.post(
        url,
        # post the credentials as JSON
        {'email': user.email, 'password': 'testpassword'},
        content_type='application/json'
    )
    assert response.status_code == 200
    assert 'access' in response.json()
    assert 'user' in response.json()
