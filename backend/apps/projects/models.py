from typing import TYPE_CHECKING
from uuid import UUID

from django.db import models

from apps.core.models import BaseModel

if TYPE_CHECKING:
    from django.db.models.manager import Manager as RelatedManager


class Project(BaseModel):
    class ProjectStatus(models.TextChoices):
        PLANNING = "planning", "Planning"
        ACTIVE = "active", "Active"
        HOLD = "hold", "Hold"
        DONE = "done", "Done"

    organisation = models.ForeignKey(
        "accounts.Organisation",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.CASCADE,
        related_name="projects",
    )
    proposal = models.ForeignKey(
        "proposals.Proposal",
        on_delete=models.SET_NULL,
        related_name="projects",
        null=True,
        blank=True,
    )
    if TYPE_CHECKING:
        organisation_id: UUID
        client_id: UUID
        proposal_id: UUID | None
        invoices: RelatedManager["Invoice"]
        milestones: RelatedManager["Milestone"]
        time_logs: RelatedManager["TimeLog"]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
    )
    start_date = models.DateField()
    due_date = models.DateField()
    budget = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self) -> str:
        return self.title


class Milestone(BaseModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="milestones",
    )
    if TYPE_CHECKING:
        project_id: UUID

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    due_date = models.DateField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.title} ({'Completed' if self.is_completed else 'Pending'})"


class TimeLog(BaseModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="time_logs",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="time_logs",
    )
    if TYPE_CHECKING:
        project_id: UUID
        user_id: UUID

    log_date = models.DateField()
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(blank=True)
    is_billable = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.user} - {self.hours}h on {self.log_date}"


if TYPE_CHECKING:
    from apps.invoices.models import Invoice
