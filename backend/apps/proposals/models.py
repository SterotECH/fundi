from django.db import models

from apps.core.models import BaseModel


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
