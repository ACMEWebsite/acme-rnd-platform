from django.contrib import admin

from .models import LiteratureMessage, LiteratureWorkspace


@admin.register(LiteratureWorkspace)
class LiteratureWorkspaceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "created_by",
        "document_count",
        "total_pages",
        "created_at",
    )
    readonly_fields = ("context_sha256", "created_at", "updated_at")
    exclude = ("context_text",)


@admin.register(LiteratureMessage)
class LiteratureMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "workspace", "role", "provider", "created_at")
    list_filter = ("role", "provider")
