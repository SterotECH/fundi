class LeadAlreadyConvertedError(Exception):
    """
    Raised when an already-converted lead is converted again.

    This belongs to the clients domain because it represents a lead conversion
    business rule. The global exception handler is only responsible for
    translating it into an HTTP response.
    """
