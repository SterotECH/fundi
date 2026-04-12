from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

API_V1_PREFIX = "api/v1/"

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI schema — generated automatically from your ViewSets
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # All v1 API routes delegated to apps
    path(API_V1_PREFIX, include("apps.core.urls")),
    path(API_V1_PREFIX, include("apps.accounts.urls")),
    path(API_V1_PREFIX, include("apps.clients.urls")),
    path(API_V1_PREFIX, include("apps.proposals.urls")),
    path(API_V1_PREFIX, include("apps.projects.urls")),
    path(API_V1_PREFIX, include("apps.invoices.urls")),
]
