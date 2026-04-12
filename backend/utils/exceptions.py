from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    if isinstance(exc, ObjectDoesNotExist):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    return exception_handler(exc, context)
