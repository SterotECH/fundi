from rest_framework.routers import DefaultRouter

from apps.projects.views import ProjectViewSet, TimeLogViewSet

router = DefaultRouter(use_regex_path=False)
router.register("projects", ProjectViewSet, basename="project")
router.register("timelogs", TimeLogViewSet, basename="timelog")

urlpatterns = router.urls
