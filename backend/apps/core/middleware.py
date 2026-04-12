from contextvars import ContextVar

_current_request = ContextVar("current_request", default=None)


class CurrentRequestMiddleware:
    """
    Keep the active request available to signal handlers during this request.

    DRF authenticates JWT users inside the view dispatch, so this middleware
    stores the request object itself. The audit signal reads `request.user`
    later, after DRF has had a chance to authenticate the request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current_request.set(request)
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(token)


def get_current_request():
    return _current_request.get()


def get_current_user():
    request = get_current_request()
    if request is None:
        return None

    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        return None

    return user
