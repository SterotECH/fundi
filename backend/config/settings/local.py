from .base import *

DEBUG = True

ALLOWED_HOSTS = ["*"]

# CORS — allow React dev server
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3030",
    "http://127.0.0.1:3030",
]

CORS_ALLOW_CREDENTIALS = True  # needed so the browser sends the HttpOnly cookie

# Faster password hashing in development — bcrypt is slow by design, MD5 is fine locally
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Django Debug Toolbar (add later if you want it)
# INSTALLED_APPS += ['debug_toolbar']
