from django.urls import path

from .views import LoginView, MeView, PreferencesView, RegisterView, SecretsView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", MeView.as_view(), name="me"),
    path("secrets/", SecretsView.as_view(), name="secrets"),
    path("preferences/", PreferencesView.as_view(), name="preferences"),
]
