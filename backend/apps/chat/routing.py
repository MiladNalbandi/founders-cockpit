from django.urls import path

from .consumers import ProjectConsumer

websocket_urlpatterns = [
    path("ws/projects/<int:project_id>/", ProjectConsumer.as_asgi()),
]
