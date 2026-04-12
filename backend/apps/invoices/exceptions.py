from rest_framework.exceptions import APIException


class CannotDeleteInvoiceError(APIException):
    status_code = 400
    default_detail = "Only draft invoices can be deleted."
    default_code = "cannot_delete_invoice"


class CannotUpdateInvoiceError(APIException):
    status_code = 400
    default_detail = "Only draft invoices can be updated."
    default_code = "cannot_update_invoice"


class CannotSendInvoiceError(APIException):
    status_code = 400
    default_detail = "Only draft invoices can be sent."
    default_code = "cannot_send_invoice"


class InvalidInvoiceClientError(APIException):
    status_code = 400
    default_detail = "Client must belong to the same organisation as the invoice."
    default_code = "invalid_invoice_client"


class InvalidInvoiceProjectError(APIException):
    status_code = 400
    default_detail = (
        "Project must belong to the same organisation and client as the invoice."
    )
    default_code = "invalid_invoice_project"


class InvalidInvoiceLineItemError(APIException):
    status_code = 400
    default_detail = "Invoice must have at least one valid line item."
    default_code = "invalid_invoice_line_item"


class InvalidPaymentAmountError(APIException):
    status_code = 400
    default_detail = "Payment amount must be positive."
    default_code = "invalid_payment_amount"
