from django.conf import settings
from django.db import models
class DoeRun(models.Model):
    created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT)
    created_at=models.DateTimeField(auto_now_add=True,db_index=True)
    factors=models.JSONField(default=list)
    responses=models.JSONField(default=list)
    design=models.JSONField(default=list)
    class Meta: ordering=["-created_at"]
