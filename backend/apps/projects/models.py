from django.db import models

from apps.core.models import BaseModel


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

    def __str__(self):
        return self.title
