from __future__ import annotations

from getpass import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.management.commands._organisation import (
    resolve_organisation_for_command,
)


User = get_user_model()


class Command(BaseCommand):
    """
    Create a regular user with organisation selection/creation support.
    """

    help = "Create a user and attach them to an organisation."

    def add_arguments(self, parser):
        parser.add_argument("--email", dest="email", default="")
        parser.add_argument("--full-name", dest="full_name", default="")
        parser.add_argument(
            "--password",
            dest="password",
            default="",
            help="User password. If omitted in interactive mode, you will be prompted.",
        )
        parser.add_argument(
            "--role",
            dest="role",
            default="owner",
            choices=("owner", "admin", "member"),
            help="Application role for the new user.",
        )
        parser.add_argument(
            "--organisation-slug",
            dest="organisation_slug",
            default="",
            help="Existing organisation slug to assign to the user.",
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
        parser.add_argument(
            "--no-input",
            "--noinput",
            action="store_false",
            dest="interactive",
            help="Do NOT prompt for missing values.",
        )

    def handle(self, *args, **options):
        interactive = options.get("interactive", True)
        email = (options.get("email") or "").strip()
        full_name = (options.get("full_name") or "").strip()
        password = options.get("password") or ""
        role = options.get("role") or "owner"

        if interactive and not email:
            email = self._prompt("Email")
        if interactive and not full_name:
            full_name = self._prompt("Full name")
        if interactive and not password:
            password = getpass("Password: ").strip()

        if not email:
            raise CommandError("Email is required.")
        if not full_name:
            raise CommandError("Full name is required.")
        if not password:
            raise CommandError("Password is required.")
        if User.objects.filter(email=email).exists():
            raise CommandError(f"A user with email '{email}' already exists.")

        organisation = resolve_organisation_for_command(
            interactive=interactive,
            organisation_slug=options.get("organisation_slug", ""),
            create_organisation=options.get("create_organisation", False),
            organisation_name=options.get("organisation_name", ""),
            stdin=self.stdin,
            stdout=self.stdout,
        )

        user = User.objects.create_user(
            email=email,
            password=password,
            full_name=full_name,
            organisation=organisation,
            role=role,
            is_active=True,
            is_staff=False,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Created user {user.email} in {organisation.name} ({organisation.slug})."
            )
        )

    def _prompt(self, label: str) -> str:
        self.stdout.write(f"{label}:")
        return (self.stdin.readline() if self.stdin else input()).strip()
