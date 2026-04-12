from rest_framework.exceptions import APIException


class InvalidProjectClientError(APIException):
    status_code = 400
    default_detail = "Client must belong to the same organisation as the project."
    default_code = "invalid_project_client"


class InvalidProjectProposalError(APIException):
    status_code = 400
    default_detail = (
        "Proposal must belong to the same organisation and client as the project."
    )
    default_code = "invalid_project_proposal"


class InvalidProjectDateRangeError(APIException):
    status_code = 400
    default_detail = "Project due date cannot be before start date."
    default_code = "invalid_project_date_range"


class InvalidProjectBudgetError(APIException):
    status_code = 400
    default_detail = "Project budget must be positive."
    default_code = "invalid_project_budget"
