# apps/accounts/tests/test_auth.py
import pytest
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import services


@pytest.mark.django_db
def test_login_rejects_invalid_credentials(client, user):
    response = client.post(
        reverse("auth-login"),
        {"email": user.email, "password": "wrong-password"},
        content_type="application/json",
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials."


@pytest.mark.django_db
def test_login_returns_access_token(client, user):
    url = reverse("auth-login")
    response = client.post(
        url,
        # post the credentials as JSON
        {"email": user.email, "password": "testpassword"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert "access" in response.json()
    assert "user" in response.json()
    assert response.cookies["refresh_token"]["httponly"]


@pytest.mark.django_db
def test_login_accepts_case_insensitive_email(client, user):
    response = client.post(
        reverse("auth-login"),
        {"email": user.email.upper(), "password": "testpassword"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert "access" in response.json()


@pytest.mark.django_db
def test_refresh_requires_refresh_cookie(client):
    response = client.post(reverse("auth-refresh"))

    assert response.status_code == 401
    assert response.json()["detail"] == "No refresh token provided."


@pytest.mark.django_db
def test_refresh_rejects_invalid_refresh_cookie(client):
    client.cookies["refresh_token"] = "not-a-valid-refresh-token"

    response = client.post(reverse("auth-refresh"))

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired refresh token."


@pytest.mark.django_db
def test_refresh_returns_new_access_token(client, user):
    refresh = RefreshToken.for_user(user)
    client.cookies["refresh_token"] = str(refresh)

    response = client.post(reverse("auth-refresh"))

    assert response.status_code == 200
    assert "access" in response.json()


@pytest.mark.django_db
def test_logout_deletes_refresh_cookie(client, user):
    refresh = RefreshToken.for_user(user)
    client.cookies["refresh_token"] = str(refresh)

    response = client.post(reverse("auth-logout"))

    assert response.status_code == 204
    assert response.cookies["refresh_token"].value == ""


@pytest.mark.django_db
def test_logout_succeeds_without_refresh_cookie(client):
    response = client.post(reverse("auth-logout"))

    assert response.status_code == 204


@pytest.mark.django_db
def test_logout_service_ignores_invalid_refresh_token():
    """
    Logout should be idempotent: invalid or already-dead tokens still succeed.
    """
    services.logout_user("not-a-valid-refresh-token")


@pytest.mark.django_db
def test_me_returns_authenticated_user(authenticated_client, user):
    response = authenticated_client.get(reverse("auth-me"))

    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["full_name"] == user.full_name


@pytest.mark.django_db
def test_me_patch_updates_profile_and_password(authenticated_client, user):
    response = authenticated_client.patch(
        reverse("auth-me"),
        {
            "full_name": "Updated User",
            "password": "new-test-password",
        },
        content_type="application/json",
    )

    user.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated User"
    assert user.full_name == "Updated User"
    assert user.check_password("new-test-password")
