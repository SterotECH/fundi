# config/settings/test.py
from .base import *

DATABASES["default"]["HOST"] = "localhost"
DATABASES["default"]["NAME"] = "fundi_test"
DATABASES["default"]["USER"] = config("DB_TEST_USER", default="fundi_test")
DATABASES["default"]["PASSWORD"] = config("DB_TEST_PASSWORD", default="fundi_test")
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
