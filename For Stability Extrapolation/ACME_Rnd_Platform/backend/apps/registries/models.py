from django.conf import settings
from django.db import models


class RegistrySearch(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    registry = models.CharField(max_length=40)
    query = models.CharField(max_length=500)
    result_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
