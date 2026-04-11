from django.conf import settings
from django.db import OperationalError, ProgrammingError
from django.urls import reverse_lazy

from apps.accounts.models import Organisation, User
from apps.clients.models import Client
from apps.core.models import AuditLog


def _safe_count(queryset) -> int:
    try:
        return queryset.count()
    except (OperationalError, ProgrammingError):
        return 0


def _safe_slice(queryset, limit: int):
    try:
        return list(queryset[:limit])
    except (OperationalError, ProgrammingError):
        return []


def dashboard_callback(request, context):
    """
    Inject branded dashboard data into the Unfold admin index page.

    The callback keeps the admin dashboard useful even before the full product
    dashboard exists by surfacing counts and recent audit activity.
    """
    active_clients = _safe_count(Client.objects.filter(is_archived=False))
    archived_clients = _safe_count(Client.objects.filter(is_archived=True))

    context.update(
        {
            "dashboard_kpis": [
                {
                    "title": "Active clients",
                    "value": active_clients,
                    "tone": "primary",
                    "icon": "school",
                    "hint": "Live institutions in the CRM",
                },
                {
                    "title": "Archived clients",
                    "value": archived_clients,
                    "tone": "gray",
                    "icon": "archive",
                    "hint": "Preserved history, hidden from active lists",
                },
                {
                    "title": "Team users",
                    "value": _safe_count(User.objects.all()),
                    "tone": "teal",
                    "icon": "people",
                    "hint": "Accounts with access to the system",
                },
                {
                    "title": "Audit events",
                    "value": _safe_count(AuditLog.objects.all()),
                    "tone": "amber",
                    "icon": "history",
                    "hint": "Recorded changes across the system",
                },
            ],
            "dashboard_quick_links": [
                {
                    "title": "Clients",
                    "description": "Browse schools and institutions in the CRM.",
                    "icon": "school",
                    "link": reverse_lazy("admin:clients_client_changelist"),
                    "tone": "primary",
                },
                {
                    "title": "Users",
                    "description": "Manage internal access and account roles.",
                    "icon": "badge",
                    "link": reverse_lazy("admin:accounts_user_changelist"),
                    "tone": "teal",
                },
                {
                    "title": "Audit log",
                    "description": "Inspect create, update, archive, and system events.",
                    "icon": "receipt_long",
                    "link": reverse_lazy("admin:core_auditlog_changelist"),
                    "tone": "amber",
                },
                {
                    "title": "API schema",
                    "description": "Open the generated backend contract.",
                    "icon": "data_object",
                    "link": reverse_lazy("schema"),
                    "tone": "blue",
                },
            ],
            "dashboard_recent_audit_logs": _safe_slice(
                AuditLog.objects.select_related("user", "organisation").all(),
                8,
            ),
            "dashboard_meta": {
                "organisation_count": _safe_count(Organisation.objects.all()),
                "debug": settings.DEBUG,
            },
        }
    )

    return context
