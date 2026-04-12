from rest_framework.routers import DefaultRouter

from apps.projects.views import ProjectViewSet

router = DefaultRouter(use_regex_path=False)
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = router.urls
