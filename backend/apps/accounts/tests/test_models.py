import pytest

from apps.accounts.factories import OrganisationFactory, UserFactory
from apps.accounts.models import User


@pytest.mark.django_db
def test_organisation_string_returns_name():
    organisation = OrganisationFactory(name="Stero Tech")

    assert str(organisation) == "Stero Tech"


@pytest.mark.django_db
def test_user_string_returns_name_and_email():
    user = UserFactory(full_name="Samuel Agyei", email="samuel@example.com")

    assert str(user) == "Samuel Agyei (samuel@example.com)"


@pytest.mark.django_db
def test_create_user_requires_email(org):
    with pytest.raises(ValueError, match="email address"):
        User.objects.create_user(email="", password="testpassword", organisation=org)


@pytest.mark.django_db
def test_create_user_requires_organisation():
    with pytest.raises(ValueError, match="organisation"):
        User.objects.create_user(email="user@example.com", password="testpassword")


@pytest.mark.django_db
def test_create_superuser_sets_required_flags(org):
    user = User.objects.create_superuser(
        email="admin@example.com",
        password="testpassword",
        full_name="Admin User",
        organisation=org,
    )

    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.is_active is True


@pytest.mark.django_db
def test_create_superuser_rejects_is_staff_false(org):
    with pytest.raises(ValueError, match="is_staff=True"):
        User.objects.create_superuser(
            email="admin@example.com",
            password="testpassword",
            full_name="Admin User",
            organisation=org,
            is_staff=False,
        )


@pytest.mark.django_db
def test_create_superuser_rejects_is_superuser_false(org):
    with pytest.raises(ValueError, match="is_superuser=True"):
        User.objects.create_superuser(
            email="admin@example.com",
            password="testpassword",
            full_name="Admin User",
            organisation=org,
            is_superuser=False,
        )
