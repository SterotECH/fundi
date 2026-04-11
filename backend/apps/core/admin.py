from django.contrib import admin
from django.contrib.admin.models import LogEntry

from apps.core.models import AuditLog

try:
    # Use Unfold when available so these admin tables match the rest of the UI.
    from unfold.admin import ModelAdmin
except ImportError:  # pragma: no cover - local fallback for non-poetry shells
    from django.contrib.admin import ModelAdmin


try:
    admin.site.unregister(LogEntry)
except admin.sites.NotRegistered:
    pass


@admin.register(AuditLog)
class AuditLogAdmin(ModelAdmin):
    """
    Read-focused admin table for application audit logs.
    """

    list_display = (
        "timestamp",
        "action",
        "entity_type",
        "entity_id",
        "organisation",
        "user",
    )
    list_filter = (
        "action",
        "entity_type",
        "organisation",
        "timestamp",
    )
    search_fields = (
        "entity_type",
        "entity_id",
        "organisation__name",
        "user__email",
        "user__full_name",
    )
    ordering = ("-timestamp",)
    readonly_fields = (
        "id",
        "timestamp",
        "user",
        "organisation",
        "action",
        "entity_type",
        "entity_id",
        "diff",
    )
    list_select_related = ("user", "organisation")
    raw_id_fields = ("user", "organisation")

    fieldsets = (
        (
            "Audit Event",
            {
                "fields": (
                    "id",
                    "timestamp",
                    "action",
                    "entity_type",
                    "entity_id",
                )
            },
        ),
        (
            "Ownership",
            {
                "fields": (
                    "organisation",
                    "user",
                )
            },
        ),
        (
            "Diff",
            {"fields": ("diff",)},
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LogEntry)
class LogEntryAdmin(ModelAdmin):
    """
    Styled table for Django admin's own change log entries.
    """

    list_display = (
        "action_time",
        "user",
        "content_type",
        "object_repr",
        "action_flag",
    )
    list_filter = (
        "action_flag",
        "content_type",
        "action_time",
    )
    search_fields = (
        "object_repr",
        "change_message",
        "user__email",
        "user__full_name",
    )
    ordering = ("-action_time",)
    readonly_fields = (
        "action_time",
        "user",
        "content_type",
        "object_id",
        "object_repr",
        "action_flag",
        "change_message",
    )
    list_select_related = ("user", "content_type")

    fieldsets = (
        (
            "Admin Log Entry",
            {
                "fields": (
                    "action_time",
                    "user",
                    "content_type",
                    "object_id",
                    "object_repr",
                    "action_flag",
                    "change_message",
                )
            },
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
