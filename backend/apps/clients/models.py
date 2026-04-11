from django.db import models

from apps.core.models import BaseModel

class Client(BaseModel):
    class ClientType(models.TextChoices):
        SHS = 'shs', 'SHS'
        JHS = 'jhs', 'JHS'
        INTL = 'intl', 'International'
        UNI = 'uni', 'University'

    type = models.CharField(
        max_length=20,
        choices=ClientType.choices,
    )
    organisation = models.ForeignKey(
        'accounts.Organisation',
        on_delete=models.CASCADE,
        related_name='clients'
    )
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    contact_person = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    region = models.CharField(max_length=100, blank=True, default='Ghana')
    is_archived = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.name
