from rest_framework.routers import DefaultRouter

from apps.invoices.views import InvoiceViewSet

router = DefaultRouter(use_regex_path=False)
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = router.urls
