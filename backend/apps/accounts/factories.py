import factory

from apps.accounts.models import Organisation, User


class OrganisationFactory(factory.django.DjangoModelFactory):
    """
    Test factory for organisations.

    Factories keep test setup small and readable. Instead of repeating
    `Organisation.objects.create(...)` in every test, call
    `OrganisationFactory()` and override only the fields that matter.
    """

    class Meta:
        model = Organisation

    name = factory.Sequence(lambda number: f"Test Organisation {number}")
    slug = factory.Sequence(lambda number: f"test-organisation-{number}")
    currency = "GHS"
    country = "GH"
    subscription_plan = Organisation.SubscriptionPlan.FREE


class UserFactory(factory.django.DjangoModelFactory):
    """
    Test factory for users.

    `create_user()` is used here so tests get the same password hashing and
    validation path as real application users.
    """

    class Meta:
        model = User

    email = factory.Sequence(lambda number: f"user{number}@example.com")
    full_name = factory.Sequence(lambda number: f"Test User {number}")
    organisation = factory.SubFactory(OrganisationFactory)
    password = "testpassword"

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", None)
        return model_class.objects.create_user(*args, password=password, **kwargs)
