from typing import TYPE_CHECKING
from uuid import UUID

from django.db import models

from apps.core.models import BaseModel

if TYPE_CHECKING:
    from django.db.models.manager import Manager as RelatedManager


class Proposal(BaseModel):
    """
    Model representing a proposal for a client.
    """

    class ProposalStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        NEGOTIATING = "negotiating", "Negotiating"
        WON = "won", "Won"
        LOST = "lost", "Lost"

    organisation = models.ForeignKey(
        "accounts.Organisation",
        on_delete=models.CASCADE,
        related_name="proposals",
    )
    client = models.ForeignKey(
        "clients.Client",
        on_delete=models.CASCADE,
        related_name="proposals",
    )
    if TYPE_CHECKING:
        organisation_id: UUID
        client_id: UUID
        projects: RelatedManager["Project"]

    title = models.CharField(max_length=255)
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=ProposalStatus.choices,
        default=ProposalStatus.DRAFT,
    )
    sent_date = models.DateField(null=True, blank=True)
    deadline = models.DateField()
    decision_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)


if TYPE_CHECKING:
    from apps.projects.models import Project
