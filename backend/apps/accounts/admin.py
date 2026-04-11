from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as DjangoGroupAdmin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import Group

from apps.accounts.models import Organisation, User

try:
    from unfold.admin import ModelAdmin
    from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
except ImportError:  # pragma: no cover - local fallback for non-poetry shells
    from django.contrib.admin import ModelAdmin

    AdminPasswordChangeForm = None
    UserChangeForm = None
    UserCreationForm = None


@admin.register(Organisation)
class OrganisationAdmin(ModelAdmin):
    """
    Admin configuration for organisations.
    """

    list_display = (
        "name",
        "slug",
        "subscription_plan",
        "currency",
        "country",
        "created_at",
    )
    list_filter = (
        "subscription_plan",
        "currency",
        "country",
        "created_at",
    )
    search_fields = (
        "name",
        "slug",
    )
    ordering = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (
            "Organisation",
            {
                "fields": (
                    "id",
                    "name",
                    "slug",
                    "subscription_plan",
                )
            },
        ),
        (
            "Locale",
            {
                "fields": (
                    "currency",
                    "country",
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


@admin.register(User)
class UserAdmin(DjangoUserAdmin, ModelAdmin):
    """
    Admin configuration for the custom email-based user model.
    """

    if UserChangeForm is not None:
        form = UserChangeForm

    if UserCreationForm is not None:
        add_form = UserCreationForm

    if AdminPasswordChangeForm is not None:
        change_password_form = AdminPasswordChangeForm

    ordering = ("email",)
    list_display = (
        "email",
        "full_name",
        "organisation",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "created_at",
    )
    list_filter = (
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "organisation",
        "created_at",
    )
    search_fields = (
        "email",
        "full_name",
        "organisation__name",
    )
    readonly_fields = ("id", "created_at", "updated_at", "last_login")
    list_select_related = ("organisation",)
    raw_id_fields = ("organisation",)

    fieldsets = (
        (
            "Account",
            {
                "fields": (
                    "id",
                    "email",
                    "password",
                    "full_name",
                    "organisation",
                    "role",
                )
            },
        ),
        (
            "Access",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Audit",
            {
                "fields": (
                    "last_login",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "organisation",
                    "role",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )


try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass


@admin.register(Group)
class GroupAdmin(DjangoGroupAdmin, ModelAdmin):
    """
    Styled admin for Django auth groups.
    """

    search_fields = ("name",)
