from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from apps.clients.exceptions import LeadAlreadyConvertedError


def custom_exception_handler(exc, context):
    if isinstance(exc, ObjectDoesNotExist):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if isinstance(exc, LeadAlreadyConvertedError):
        return Response(
            {"detail": "This lead has already been converted to a client."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return exception_handler(exc, context)
