import uuid
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        DELETED = "deleted", "Deleted"
        STATUS_CHANGED = "status_changed", "Status Changed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    organisation = models.ForeignKey(
        "accounts.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    if TYPE_CHECKING:
        user_id: uuid.UUID | None
        organisation_id: uuid.UUID | None

    action = models.CharField(max_length=20, choices=Action.choices)
    entity_type = models.CharField(max_length=255)
    entity_id = models.UUIDField()
    diff = models.JSONField(default=dict, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return (
            f"{self.get_action_display()} {self.entity_type} "
            f"({self.entity_id}) at {self.timestamp}"
        )

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["organisation", "-timestamp"]),
        ]


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        INVOICE_OVERDUE = "invoice_overdue", "Invoice Overdue"
        PROPOSAL_DEADLINE = "proposal_deadline", "Proposal Deadline"
        PROJECT_DUE = "project_due", "Project Due"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    if TYPE_CHECKING:
        user_id: uuid.UUID

    type = models.CharField(max_length=20, choices=NotificationType.choices)
    message = models.TextField()
    entity_type = models.CharField(max_length=255, null=True, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Notification for {self.user} at {self.created_at}"

    class Meta:
        ordering = ["-created_at"]
