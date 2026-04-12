# config/settings/base.py

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config
from django.templatetags.static import static
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _

BASE_DIR = Path(__file__).resolve().parent.parent.parent
# ^^ Three .parent calls now — base.py is one level deeper than settings.py was.
# settings.py was at config/settings.py → parent = config/ → parent = backend/
# base.py is at config/settings/base.py:
# parent = config/settings/ → parent = config/ → parent = backend/

SECRET_KEY = config("SECRET_KEY")

DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

# --- Apps ---

DJANGO_APPS = [
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    # Needed for logout because refresh tokens are blacklisted.
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "django_celery_beat",
]

LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.clients",
    "apps.proposals",
    "apps.projects",
    "apps.invoices",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# --- Middleware ---

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Must be as high as possible, before CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.CurrentRequestMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# --- URL / WSGI ---

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# --- Templates ---

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database ---

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="fundi"),
        "USER": config("DB_USER", default="fundi"),
        "PASSWORD": config("DB_PASSWORD", default="fundi"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# --- Auth ---

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
        )
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internationalisation ---

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Accra"
USE_I18N = True
USE_TZ = True

# --- Static files ---

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Default PK ---

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
# ^^ We're using UUIDs explicitly on every model, so this never fires in practice.
# But setting it prevents Django from nagging you about it.

# --- DRF ---

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "utils.exceptions.custom_exception_handler",
}

# --- SimpleJWT ---

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_COOKIE": "refresh_token",  # cookie name
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_SECURE": config("COOKIE_SECURE", default=False, cast=bool),
    "AUTH_COOKIE_SAMESITE": "Lax",
}

# --- drf-spectacular ---

SPECTACULAR_SETTINGS = {
    "TITLE": "Fundi API",
    "DESCRIPTION": "Company OS for African freelancers and small teams.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# --- Celery ---

CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# --- Unfold admin branding ---

UNFOLD = {
    "SITE_TITLE": "Stero Tech Admin",
    "SITE_HEADER": "Stero Tech Inc.",
    "SITE_SUBHEADER": "Company OS",
    "SITE_URL": "/admin/",
    "SITE_SYMBOL": "space_dashboard",
    "SITE_ICON": {
        "light": lambda request: static("core/admin/brand/stero-icon-light.svg"),
        "dark": lambda request: static("core/admin/brand/stero-icon-dark.svg"),
    },
    "SITE_LOGO": {
        "light": lambda request: static("core/admin/brand/stero-logo-light.svg"),
        "dark": lambda request: static("core/admin/brand/stero-logo-dark.svg"),
    },
    "SITE_FAVICONS": [
        {
            "rel": "icon",
            "type": "image/svg+xml",
            "href": lambda request: static("core/admin/brand/stero-favicon.svg"),
        },
    ],
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "SHOW_BACK_BUTTON": False,
    "BORDER_RADIUS": "12px",
    "STYLES": [
        lambda request: static("core/admin/unfold-overrides.css"),
    ],
    "DASHBOARD_CALLBACK": "apps.core.unfold.dashboard_callback",
    "COLORS": {
        "base": {
            "50": "#F1EFE8",
            "100": "#D3D1C7",
            "200": "#C0BDB1",
            "300": "#A8A59A",
            "400": "#888780",
            "500": "#6F6E68",
            "600": "#5F5E5A",
            "700": "#4F4E4A",
            "800": "#444441",
            "900": "#2F2F2C",
            "950": "#1F1F1D",
        },
        "primary": {
            "50": "#EEEDFE",
            "100": "#CECBF6",
            "200": "#AFA9EC",
            "300": "#978FE4",
            "400": "#7F77DD",
            "500": "#6A62CD",
            "600": "#534AB7",
            "700": "#463E9C",
            "800": "#3C3489",
            "900": "#26215C",
            "950": "#1B163F",
        },
        "font": {
            "subtle-light": "var(--color-base-500)",
            "subtle-dark": "var(--color-base-400)",
            "default-light": "var(--color-base-600)",
            "default-dark": "var(--color-base-300)",
            "important-light": "var(--color-base-900)",
            "important-dark": "var(--color-base-100)",
        },
    },
    "SITE_DROPDOWN": [
        {
            "icon": "home",
            "title": _("Admin dashboard"),
            "link": reverse_lazy("admin:index"),
        },
        {
            "icon": "code",
            "title": _("API schema"),
            "link": reverse_lazy("schema"),
        },
        {
            "icon": "preview",
            "title": _("Swagger UI"),
            "link": reverse_lazy("swagger-ui"),
        },
    ],
    "SIDEBAR": {
        "show_search": True,
        "command_search": False,
        "show_all_applications": False,
        "navigation": [
            {
                "title": _("Workspace"),
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": _("Dashboard"),
                        "icon": "space_dashboard",
                        "link": reverse_lazy("admin:index"),
                    },
                    {
                        "title": _("Clients"),
                        "icon": "school",
                        "link": reverse_lazy("admin:clients_client_changelist"),
                    },
                ],
            },
            {
                "title": _("Access"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Users"),
                        "icon": "people",
                        "link": reverse_lazy("admin:accounts_user_changelist"),
                    },
                    {
                        "title": _("Organisations"),
                        "icon": "apartment",
                        "link": reverse_lazy("admin:accounts_organisation_changelist"),
                    },
                    {
                        "title": _("Groups"),
                        "icon": "shield",
                        "link": reverse_lazy("admin:auth_group_changelist"),
                    },
                ],
            },
            {
                "title": _("Audit"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Audit logs"),
                        "icon": "history",
                        "link": reverse_lazy("admin:core_auditlog_changelist"),
                    },
                    {
                        "title": _("Admin activity"),
                        "icon": "receipt_long",
                        "link": reverse_lazy("admin:admin_logentry_changelist"),
                    },
                ],
            },
            {
                "title": _("Developer"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("API schema"),
                        "icon": "data_object",
                        "link": reverse_lazy("schema"),
                    },
                    {
                        "title": _("Swagger UI"),
                        "icon": "preview",
                        "link": reverse_lazy("swagger-ui"),
                    },
                ],
            },
        ],
    },
}
