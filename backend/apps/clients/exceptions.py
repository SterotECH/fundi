from rest_framework.exceptions import APIException


class LeadAlreadyConvertedError(APIException):
    status_code = 400
    default_detail = "This lead has already been converted to a client."
    default_code = "lead_already_converted"
