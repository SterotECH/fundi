from django.contrib import admin

from apps.clients.models import Client

try:
    # Use Unfold's admin class when the package is available in the runtime.
    from unfold.admin import ModelAdmin
except ImportError:  # pragma: no cover - local fallback for non-poetry shells
    from django.contrib.admin import ModelAdmin


@admin.register(Client)
class ClientAdmin(ModelAdmin):
    """
    Admin configuration for client records.

    The goals here are simple:
    - make the default list screen useful for browsing and support work
    - expose the tenant relationship clearly in admin
    - make archived-vs-active clients easy to filter
    """

    list_display = (
        "name",
        "type",
        "organisation",
        "contact_person",
        "email",
        "phone",
        "region",
        "is_archived",
        "created_at",
    )
    list_filter = (
        "type",
        "is_archived",
        "region",
        "organisation",
        "created_at",
    )
    search_fields = (
        "name",
        "email",
        "contact_person",
        "phone",
        "organisation__name",
    )
    ordering = ("name", "-created_at")
    readonly_fields = ("id", "created_at", "updated_at")
    list_select_related = ("organisation",)
    raw_id_fields = ("organisation",)

    fieldsets = (
        (
            "Client",
            {
                "fields": (
                    "id",
                    "organisation",
                    "type",
                    "name",
                    "contact_person",
                    "email",
                    "phone",
                )
            },
        ),
        (
            "Profile",
            {
                "fields": (
                    "region",
                    "address",
                    "notes",
                    "is_archived",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )
