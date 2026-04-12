from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.core.views import DashboardView, NotificationViewSet

router = DefaultRouter(use_regex_path=False)
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    *router.urls,
]
