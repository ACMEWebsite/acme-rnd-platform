from django.contrib import admin
from .models import DissolutionRun


@admin.register(DissolutionRun)
class DissolutionRunAdmin(admin.ModelAdmin):
    list_display = ("id", "created_by", "created_at", "engine_version")
    list_filter = ("engine_version", "created_at")
    search_fields = ("created_by__username",)
    readonly_fields = ("created_by", "created_at", "request_payload", "response_payload", "engine_version")
