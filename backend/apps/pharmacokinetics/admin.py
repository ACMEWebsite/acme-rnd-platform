from django.contrib import admin

from .models import PharmacokineticsRun, PsgGuidance, PsgSyncEvent


@admin.register(PharmacokineticsRun)
class PharmacokineticsRunAdmin(admin.ModelAdmin):
    list_display = ("id", "compound_name", "compound_input", "created_by", "created_at")
    list_filter = ("engine_version", "created_at")
    search_fields = ("compound_name", "compound_input", "resolved_smiles", "created_by__username")
    readonly_fields = (
        "created_by",
        "created_at",
        "compound_input",
        "compound_name",
        "resolved_smiles",
        "predictions",
        "pubchem_record",
        "warnings",
        "engine_version",
    )


@admin.register(PsgGuidance)
class PsgGuidanceAdmin(admin.ModelAdmin):
    list_display = ("active_ingredient", "psg_number", "guidance_type", "posted_date")
    search_fields = ("active_ingredient", "psg_number")
    list_filter = ("guidance_type", "posted_date")


@admin.register(PsgSyncEvent)
class PsgSyncEventAdmin(admin.ModelAdmin):
    list_display = ("started_at", "completed_at", "status", "records_received")
    list_filter = ("status",)
    readonly_fields = ("started_at", "completed_at", "status", "records_received", "message")

