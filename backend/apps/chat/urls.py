from django.urls import path

from .views import buddy_thread, send_buddy_message

urlpatterns = [
    path("projects/<int:project_id>/buddy/", buddy_thread),
    path("projects/<int:project_id>/buddy/messages/", send_buddy_message),
]
