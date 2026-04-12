from rest_framework.routers import DefaultRouter

from apps.proposals.views import ProposalViewSet

router = DefaultRouter(use_regex_path=False)
router.register("proposals", ProposalViewSet, basename="proposal")

urlpatterns = router.urls
