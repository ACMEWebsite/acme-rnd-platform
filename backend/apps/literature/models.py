from django.conf import settings
from django.db import models


class LiteratureWorkspace(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    document_count = models.PositiveSmallIntegerField()
    documents = models.JSONField(default=list)
    total_pages = models.PositiveIntegerField(default=0)
    total_characters = models.PositiveIntegerField(default=0)
    context_sha256 = models.CharField(max_length=64, db_index=True)
    context_text = models.TextField()

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Literature workspace {self.pk} ({self.document_count} documents)"


class LiteratureMessage(models.Model):
    workspace = models.ForeignKey(
        LiteratureWorkspace,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    role = models.CharField(
        max_length=12,
        choices=[("user", "User"), ("assistant", "Assistant")],
    )
    text = models.TextField()
    provider = models.CharField(max_length=40, blank=True)

    class Meta:
        ordering = ["created_at", "pk"]

    def __str__(self):
        return f"{self.role} message in workspace {self.workspace_id}"
