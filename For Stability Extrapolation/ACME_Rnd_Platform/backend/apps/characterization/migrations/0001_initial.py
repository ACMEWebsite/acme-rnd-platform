import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [migrations.CreateModel(name="CharacterizationRun", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
        ("api_name", models.CharField(max_length=500)),
        ("selected_properties", models.JSONField(default=list)),
        ("selected_records", models.JSONField(default=list)),
        ("results", models.JSONField(default=list)),
        ("warnings", models.JSONField(default=list)),
        ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
    ], options={"ordering": ["-created_at"]})]
