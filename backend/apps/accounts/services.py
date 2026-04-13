from typing import Any, cast

from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User


def login_user(email: str, password: str) -> tuple[Any | None, str | None, str | None]:
    """
    Authenticate user and return (user, access_token, refresh_token).
    Returns None if credentials are invalid.
    """
    login_email = (email or "").strip()
    canonical_email = (
        User.objects.filter(email__iexact=login_email)
        .values_list("email", flat=True)
        .first()
    )
    if canonical_email:
        login_email = canonical_email

    user = authenticate(username=login_email, password=password)
    # Django's authenticate() checks email + password against the database.
    # It uses USERNAME_FIELD = 'email' so passing username=email is correct.
    if not user:
        return None, None, None

    refresh = RefreshToken.for_user(user)
    return user, str(refresh.access_token), str(refresh)


def logout_user(refresh_token: str) -> None:
    """Blacklist the refresh token so it can't be used again."""
    try:
        token = RefreshToken(cast(Any, refresh_token))
        token.blacklist()
    except Exception:
        pass  # Already blacklisted or invalid — either way, logout succeeded
