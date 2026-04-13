from __future__ import annotations

from django.core.management.base import CommandError
from django.utils.text import slugify

from apps.accounts.models import Organisation


def _build_unique_slug(base_slug: str) -> str:
    slug = base_slug or "organisation"
    candidate = slug
    suffix = 2
    while Organisation.objects.filter(slug=candidate).exists():
        candidate = f"{slug}-{suffix}"
        suffix += 1
    return candidate


def _create_organisation(*, name: str, slug: str = "") -> Organisation:
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise CommandError("Organisation name is required.")

    cleaned_slug = slugify((slug or cleaned_name).strip())
    final_slug = _build_unique_slug(cleaned_slug)
    return Organisation.objects.create(name=cleaned_name, slug=final_slug)


def resolve_organisation_for_command(
    *,
    interactive: bool,
    organisation_slug: str = "",
    create_organisation: bool = False,
    organisation_name: str = "",
    organisation_field_value=None,
    stdin=None,
    stdout=None,
) -> Organisation:
    """
    Resolve an organisation for user creation commands.

    Priority:
    1) explicit FK/id value from command options
    2) --organisation-slug
    3) interactive selection/creation
    """

    if organisation_field_value:
        organisation = Organisation.objects.filter(pk=organisation_field_value).first()
        if organisation is None:
            raise CommandError("Organisation not found for provided value.")
        return organisation

    if organisation_slug:
        organisation = Organisation.objects.filter(slug=organisation_slug).first()
        if organisation:
            return organisation
        if create_organisation:
            name = organisation_name or organisation_slug.replace("-", " ").title()
            return _create_organisation(name=name, slug=organisation_slug)
        raise CommandError(
            f"Organisation '{organisation_slug}' does not exist. "
            "Use --create-organisation to create it."
        )

    if not interactive:
        raise CommandError(
            "Organisation is required in non-interactive mode. "
            "Provide --organisation-slug (and --create-organisation if needed)."
        )

    organisations = list(Organisation.objects.order_by("name")[:50])
    if organisations:
        stdout.write("Available organisations:")
        for index, organisation in enumerate(organisations, start=1):
            stdout.write(f"  {index}. {organisation.name} ({organisation.slug})")
        stdout.write("Type a number, an organisation slug, or 'new' to create one.")
        selection = (stdin.readline() if stdin else input()).strip()
    else:
        stdout.write("No organisations found. Creating one now.")
        selection = "new"

    if selection.lower() == "new":
        stdout.write("Organisation name:")
        name = (stdin.readline() if stdin else input()).strip()
        stdout.write("Organisation slug (optional, press Enter to auto-generate):")
        slug = (stdin.readline() if stdin else input()).strip()
        organisation = _create_organisation(name=name, slug=slug)
        stdout.write(f"Created organisation: {organisation.name} ({organisation.slug})")
        return organisation

    if selection.isdigit():
        index = int(selection) - 1
        if index < 0 or index >= len(organisations):
            raise CommandError("Invalid organisation selection.")
        return organisations[index]

    organisation = Organisation.objects.filter(slug=selection).first()
    if organisation is None:
        raise CommandError("Organisation slug not found.")
    return organisation
