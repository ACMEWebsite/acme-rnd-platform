from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    SCIENTIST = "SCIENTIST", "Scientist"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.SCIENTIST)
    full_name = models.CharField(max_length=150, blank=True, default="")
    avatar_url = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        role = UserRole.ADMIN if (instance.is_superuser or instance.is_staff) else UserRole.SCIENTIST
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                "role": role,
                "full_name": instance.get_full_name() or instance.username.capitalize(),
            },
        )
    else:
        if hasattr(instance, "profile"):
            instance.profile.save()
