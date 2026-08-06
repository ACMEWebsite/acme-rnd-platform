import os
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication


class DevAutoAuthentication(BaseAuthentication):
    """
    Development auto-authentication handler.
    Allows bypassing sign-in requirements for local testing.
    Can be toggled via DEV_DISABLE_AUTH environment variable.
    """
    def authenticate(self, request):
        if os.getenv("DEV_DISABLE_AUTH", "true").lower() == "true":
            User = get_user_model()
            user, _ = User.objects.get_or_create(
                username="dev_user",
                defaults={
                    "is_staff": True,
                    "is_superuser": True,
                    "email": "dev@acme.local",
                },
            )
            return (user, None)
        return None
