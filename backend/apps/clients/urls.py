from rest_framework.routers import DefaultRouter

from apps.clients.views import ClientViewSet, LeadViewSet

router = DefaultRouter(use_regex_path=False)
router.register("clients", ClientViewSet, basename="client")
router.register("leads", LeadViewSet, basename="lead")

urlpatterns = router.urls
