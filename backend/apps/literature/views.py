from django.db import transaction
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LiteratureMessage, LiteratureWorkspace
from .serializers import LiteratureChatSerializer
from .services.assistant import (
    DEFAULT_SUGGESTIONS,
    ExternalAIUnavailable,
    external_ai_status,
    gemini_answer,
    local_evidence_answer,
)
from .services.pdf import DocumentValidationError, extract_pdf_collection


class LiteratureAnalyzeView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request):
        try:
            result = extract_pdf_collection(request.FILES.getlist("files"))
        except DocumentValidationError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        api_key = request.META.get("HTTP_X_GEMINI_KEY", "").strip()

        workspace = LiteratureWorkspace.objects.create(
            created_by=user,
            document_count=len(result["documents"]),
            documents=result["documents"],
            total_pages=result["total_pages"],
            total_characters=result["total_characters"],
            context_sha256=result["context_sha256"],
            context_text=result["context"],
        )
        return Response(
            {
                "workspace_id": workspace.pk,
                "documents": workspace.documents,
                "total_pages": workspace.total_pages,
                "total_characters": workspace.total_characters,
                "warnings": result["warnings"],
                "suggestions": DEFAULT_SUGGESTIONS,
                "external_ai": external_ai_status(api_key=api_key),
                "storage": {
                    "raw_documents_stored": False,
                    "extracted_text_stored_locally": True,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LiteratureChatView(APIView):
    @transaction.atomic
    def post(self, request):
        serializer = LiteratureChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        api_key = request.META.get("HTTP_X_GEMINI_KEY", "").strip()

        try:
            workspace = LiteratureWorkspace.objects.get(
                pk=data["workspace_id"],
                created_by=user,
            )
        except LiteratureWorkspace.DoesNotExist:
            return Response(
                {"detail": "Literature workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if data["mode"] == "gemini":
            if not data["allow_external_ai"]:
                return Response(
                    {
                        "detail": (
                            "Explicit consent is required before document text is "
                            "sent to an external AI provider."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                answer, model = gemini_answer(
                    workspace.context_text,
                    data["question"],
                    api_key=api_key,
                )
            except ExternalAIUnavailable as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            provider = f"gemini:{model}"
        else:
            answer = local_evidence_answer(
                workspace.context_text,
                data["question"],
            )
            provider = "local-evidence"

        LiteratureMessage.objects.bulk_create(
            [
                LiteratureMessage(
                    workspace=workspace,
                    role="user",
                    text=data["question"],
                    provider=provider,
                ),
                LiteratureMessage(
                    workspace=workspace,
                    role="assistant",
                    text=answer,
                    provider=provider,
                ),
            ]
        )
        workspace.save(update_fields=["updated_at"])
        return Response(
            {
                "workspace_id": workspace.pk,
                "answer": answer,
                "provider": provider,
            }
        )


class LiteratureWorkspaceDetailView(APIView):
    def get(self, request, pk):
        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        api_key = request.META.get("HTTP_X_GEMINI_KEY", "").strip()
        try:
            workspace = LiteratureWorkspace.objects.get(
                pk=pk,
                created_by=user,
            )
        except LiteratureWorkspace.DoesNotExist:
            return Response(
                {"detail": "Literature workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                "workspace_id": workspace.pk,
                "documents": workspace.documents,
                "total_pages": workspace.total_pages,
                "total_characters": workspace.total_characters,
                "messages": list(
                    workspace.messages.values(
                        "role", "text", "provider", "created_at"
                    )
                ),
                "external_ai": external_ai_status(api_key=api_key),
            }
        )

    def delete(self, request, pk):
        user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        deleted, _ = LiteratureWorkspace.objects.filter(
            pk=pk,
            created_by=user,
        ).delete()
        if not deleted:
            return Response(
                {"detail": "Literature workspace not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
