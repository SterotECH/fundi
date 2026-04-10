import pytest
from django.contrib.auth import get_user_model

from apps.accounts.models import Organisation, UserManager


@pytest.mark.django_db
def test_user_model_uses_custom_manager():
    user_model = get_user_model()

    assert isinstance(user_model._default_manager, UserManager)
    assert hasattr(user_model._default_manager, 'get_by_natural_key')


@pytest.mark.django_db
def test_create_user_requires_organisation():
    user_model = get_user_model()

    with pytest.raises(ValueError, match='organisation'):
        user_model.objects.create_user(
            email='owner@example.com',
            password='password123',
            full_name='Owner User',
        )


@pytest.mark.django_db
def test_create_superuser_sets_required_flags():
    organisation = Organisation.objects.create(
        name='Acme',
        slug='acme',
    )

    user = get_user_model().objects.create_superuser(
        email='admin@example.com',
        password='password123',
        full_name='Admin User',
        organisation=organisation,
    )

    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.organisation == organisation
    assert user.check_password('password123') is True
