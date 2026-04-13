from __future__ import annotations

from django.contrib.auth.management.commands.createsuperuser import (
    Command as DjangoCreateSuperuserCommand,
)

from apps.accounts.management.commands._organisation import (
    resolve_organisation_for_command,
)


class Command(DjangoCreateSuperuserCommand):
    """
    Enhanced superuser creation flow with organisation selection/creation.
    """

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--organisation-slug",
            dest="organisation_slug",
            default="",
            help="Existing organisation slug to assign to the superuser.",
        )
        parser.add_argument(
            "--create-organisation",
            action="store_true",
            dest="create_organisation",
            help="Create the organisation if --organisation-slug does not exist.",
        )
        parser.add_argument(
            "--organisation-name",
            dest="organisation_name",
            default="",
            help="Organisation display name when creating a new organisation.",
        )

    def handle(self, *args, **options):
        organisation = resolve_organisation_for_command(
            interactive=options.get("interactive", True),
            organisation_slug=options.get("organisation_slug", ""),
            create_organisation=options.get("create_organisation", False),
            organisation_name=options.get("organisation_name", ""),
            organisation_field_value=options.get("organisation"),
            stdin=self.stdin,
            stdout=self.stdout,
        )

        # Django's createsuperuser cleans FK inputs as raw PK values.
        options["organisation"] = organisation.pk
        return super().handle(*args, **options)
