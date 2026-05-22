from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WorkflowTaskViewSet

router = DefaultRouter()
router.register("workflow", WorkflowTaskViewSet, basename="workflow-task")

urlpatterns = [
    path("projects/<int:project_id>/tasks/", include(router.urls)),
]
