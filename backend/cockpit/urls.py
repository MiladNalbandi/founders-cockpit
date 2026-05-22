from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/projects/", include("apps.projects.urls")),
    path("api/", include("apps.agents.urls")),
    path("api/", include("apps.tasks.urls")),
    path("api/", include("apps.artifacts.urls")),
    path("api/", include("apps.chat.urls")),
    path("api/", include("apps.pipelines.urls")),
    path("api/", include("apps.tickets.urls")),
]
