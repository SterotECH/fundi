import uuid
from typing import TYPE_CHECKING, cast

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models

from apps.core.models import BaseModel

if TYPE_CHECKING:
    from django.db.models.manager import Manager as RelatedManager


class Organisation(BaseModel):
    class SubscriptionPlan(models.TextChoices):
        FREE = "free", "Free"
        PRO = "pro", "Pro"
        TEAM = "team", "Team"

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    currency = models.CharField(max_length=3, default="GHS")
    country = models.CharField(max_length=2, default="GH")
    subscription_plan = models.CharField(
        max_length=20,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.FREE,
    )
    if TYPE_CHECKING:
        users: RelatedManager["User"]
        clients: RelatedManager["Client"]
        leads: RelatedManager["Lead"]
        proposals: RelatedManager["Proposal"]
        projects: RelatedManager["Project"]
        invoices: RelatedManager["Invoice"]
        audit_logs: RelatedManager["AuditLog"]

    def __str__(self) -> str:
        return self.name

    class Meta:
        ordering = ["name"]


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields) -> "User":
        if not email:
            raise ValueError("Users must have an email address")

        organisation = extra_fields.get("organisation")
        if not organisation:
            raise ValueError("Users must belong to an organisation")
        if not isinstance(organisation, Organisation):
            organisation = Organisation.objects.filter(pk=organisation).first()
            if not organisation:
                raise ValueError("Users must belong to a valid organisation")
            extra_fields["organisation"] = organisation

        email = self.normalize_email(email)
        raw_user = self.model(
            email=email,
            **extra_fields,
        )
        user = cast("User", raw_user)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(
            email=email,
            password=password,
            **extra_fields,
        )


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"
        OWNER = "owner", "Owner"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    organisation = models.ForeignKey(
        Organisation,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )
    if TYPE_CHECKING:
        organisation_id: uuid.UUID | None
        notifications: RelatedManager["Notification"]
        audit_logs: RelatedManager["AuditLog"]
        time_logs: RelatedManager["TimeLog"]

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.OWNER,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "organisation"]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.email})"

    class Meta:
        ordering = ["full_name", "created_at"]


if TYPE_CHECKING:
    from apps.clients.models import Client, Lead
    from apps.core.models import AuditLog, Notification
    from apps.invoices.models import Invoice
    from apps.projects.models import Project, TimeLog
    from apps.proposals.models import Proposal
