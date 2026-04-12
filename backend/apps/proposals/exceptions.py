from rest_framework.exceptions import APIException


class CannotDeleteProposalError(APIException):
    status_code = 400
    default_detail = "Only proposals in DRAFT status can be deleted."
    default_code = "cannot_delete_proposal"


class CannotUpdateProposalAmountError(APIException):
    status_code = 400
    default_detail = "Proposal amount can only be changed while draft or sent."
    default_code = "cannot_update_proposal_amount"

class InvalidProposalTransitionError(APIException):
    status_code = 400
    default_detail = "Invalid proposal status transition."
    default_code = "invalid_proposal_transition"


class InvalidProposalClientError(APIException):
    status_code = 400
    default_detail = "Client must belong to the same organisation as the proposal."
    default_code = "invalid_proposal_client"
