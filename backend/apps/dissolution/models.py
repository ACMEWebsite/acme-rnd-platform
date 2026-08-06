from django.conf import settings
from django.db import models


class DissolutionRun(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    request_payload = models.JSONField()
    response_payload = models.JSONField()
    engine_version = models.CharField(max_length=32, default="1.0.0")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Dissolution run {self.pk} by {self.created_by}"
