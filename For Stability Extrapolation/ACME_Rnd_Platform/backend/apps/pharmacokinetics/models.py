from django.conf import settings
from django.db import models


class PharmacokineticsRun(models.Model):
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    compound_input = models.CharField(max_length=1000)
    compound_name = models.CharField(max_length=500, blank=True)
    resolved_smiles = models.TextField()
    predictions = models.JSONField()
    pubchem_record = models.JSONField(null=True, blank=True)
    warnings = models.JSONField(default=list)
    engine_version = models.CharField(max_length=32, default="1.0.0")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PK run {self.pk}: {self.compound_name or self.compound_input}"


class PsgGuidance(models.Model):
    psg_number = models.CharField(max_length=80, db_index=True)
    active_ingredient = models.CharField(max_length=500, db_index=True)
    guidance_type = models.CharField(max_length=80, blank=True)
    posted_date = models.DateField(null=True, blank=True, db_index=True)
    regulations_document_id = models.CharField(max_length=160, unique=True)
    pdf_url = models.URLField(max_length=1000, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["active_ingredient", "-posted_date", "psg_number"]

    def __str__(self):
        return f"{self.active_ingredient} ({self.psg_number})"


class PsgSyncEvent(models.Model):
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[("running", "Running"), ("success", "Success"), ("failed", "Failed")],
        default="running",
    )
    records_received = models.PositiveIntegerField(default=0)
    message = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]

