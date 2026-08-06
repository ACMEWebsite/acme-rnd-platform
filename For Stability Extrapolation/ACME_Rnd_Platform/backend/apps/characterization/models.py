from django.conf import settings
from django.db import models


class CharacterizationRun(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    api_name = models.CharField(max_length=500)
    selected_properties = models.JSONField(default=list)
    selected_records = models.JSONField(default=list)
    results = models.JSONField(default=list)
    warnings = models.JSONField(default=list)

    class Meta:
        ordering = ["-created_at"]
