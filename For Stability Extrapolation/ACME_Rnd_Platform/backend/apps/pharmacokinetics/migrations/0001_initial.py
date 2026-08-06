from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="PsgGuidance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("psg_number", models.CharField(db_index=True, max_length=80)),
                ("active_ingredient", models.CharField(db_index=True, max_length=500)),
                ("guidance_type", models.CharField(blank=True, max_length=80)),
                ("posted_date", models.DateField(blank=True, db_index=True, null=True)),
                ("regulations_document_id", models.CharField(max_length=160, unique=True)),
                ("pdf_url", models.URLField(blank=True, max_length=1000)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["active_ingredient", "-posted_date", "psg_number"]},
        ),
        migrations.CreateModel(
            name="PsgSyncEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(choices=[("running", "Running"), ("success", "Success"), ("failed", "Failed")], default="running", max_length=20)),
                ("records_received", models.PositiveIntegerField(default=0)),
                ("message", models.TextField(blank=True)),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="PharmacokineticsRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("compound_input", models.CharField(max_length=1000)),
                ("compound_name", models.CharField(blank=True, max_length=500)),
                ("resolved_smiles", models.TextField()),
                ("predictions", models.JSONField()),
                ("pubchem_record", models.JSONField(blank=True, null=True)),
                ("warnings", models.JSONField(default=list)),
                ("engine_version", models.CharField(default="1.0.0", max_length=32)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]

