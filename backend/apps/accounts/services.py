from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken


def login_user(email: str, password: str):
    """
    Authenticate user and return (user, access_token, refresh_token).
    Returns None if credentials are invalid.
    """
    user = authenticate(username=email, password=password)
    # Django's authenticate() checks email + password against the database.
    # It uses USERNAME_FIELD = 'email' so passing username=email is correct.
    if not user:
        return None, None, None

    refresh = RefreshToken.for_user(user)
    return user, str(refresh.access_token), str(refresh)


def logout_user(refresh_token: str):
    """Blacklist the refresh token so it can't be used again."""
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except Exception:
        pass  # Already blacklisted or invalid — either way, logout succeeded
