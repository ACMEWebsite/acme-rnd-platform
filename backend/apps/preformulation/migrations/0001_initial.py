import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name="CompatibilityRun", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
        ("api_input", models.CharField(max_length=500)), ("resolved_smiles", models.TextField(blank=True)),
        ("excipients", models.JSONField(default=list)), ("result", models.JSONField(default=dict)), ("warnings", models.JSONField(default=list)),
        ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
    ], options={"ordering": ["-created_at"]})]
