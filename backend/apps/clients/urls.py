from rest_framework.routers import DefaultRouter

from apps.clients.views import ClientViewSet

router = DefaultRouter(use_regex_path=False)
router.register("clients", ClientViewSet, basename="client")

urlpatterns = router.urls
