from django.conf import settings
from django.db import models


class CompatibilityRun(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    api_input = models.CharField(max_length=500)
    resolved_smiles = models.TextField(blank=True)
    excipients = models.JSONField(default=list)
    result = models.JSONField(default=dict)
    warnings = models.JSONField(default=list)

    class Meta:
        ordering = ["-created_at"]
