from unittest.mock import patch

import fitz
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.literature.models import LiteratureMessage, LiteratureWorkspace


def sample_pdf():
    document = fitz.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        (
            "Dissolution testing used phosphate buffer at pH 6.8. "
            "The formulation released 92 percent in 30 minutes. "
            "A small sample size was identified as a study limitation."
        ),
    )
    data = document.tobytes()
    document.close()
    return data


def sample_scanned_pdf():
    document = fitz.open()
    page = document.new_page()
    image_document = fitz.open()
    image_page = image_document.new_page(width=500, height=120)
    image_page.insert_text(
        (20, 70),
        "Scanned dissolution result: 88 percent released at 30 minutes.",
        fontsize=14,
    )
    pixmap = image_page.get_pixmap()
    page.insert_image(page.rect, stream=pixmap.tobytes("png"))
    data = document.tobytes()
    image_document.close()
    document.close()
    return data


class LiteratureApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            "literature-scientist",
            password="Strong-Test-Password-42",
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def upload_workspace(self):
        upload = SimpleUploadedFile(
            "study.pdf",
            sample_pdf(),
            content_type="application/pdf",
        )
        return self.client.post(
            "/api/v1/literature/documents/analyze/",
            {"files": [upload]},
            format="multipart",
        )

    def test_pdf_is_extracted_without_storing_raw_document(self):
        response = self.upload_workspace()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["storage"]["raw_documents_stored"])
        workspace = LiteratureWorkspace.objects.get()
        self.assertIn("[study.pdf | PAGE 1]", workspace.context_text)
        self.assertEqual(workspace.total_pages, 1)

    def test_non_pdf_is_rejected(self):
        upload = SimpleUploadedFile(
            "notes.pdf",
            b"not a pdf",
            content_type="application/pdf",
        )
        response = self.client.post(
            "/api/v1/literature/documents/analyze/",
            {"files": [upload]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    @patch(
        "apps.literature.services.pdf._ocr_page",
        return_value="Scanned dissolution result: 88 percent released at 30 minutes.",
    )
    def test_scanned_pdf_uses_local_ocr_and_keeps_page_citation(self, ocr_page):
        upload = SimpleUploadedFile(
            "scanned-study.pdf",
            sample_scanned_pdf(),
            content_type="application/pdf",
        )
        response = self.client.post(
            "/api/v1/literature/documents/analyze/",
            {"files": [upload]},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["documents"][0]["ocr_pages"], 1)
        self.assertEqual(
            response.data["documents"][0]["pages"][0]["extraction_method"],
            "ocr",
        )
        workspace = LiteratureWorkspace.objects.get()
        self.assertIn("Scanned dissolution result", workspace.context_text)
        self.assertIn("[scanned-study.pdf | PAGE 1]", workspace.context_text)
        ocr_page.assert_called_once()

    def test_local_chat_returns_page_evidence_and_is_audited(self):
        workspace_id = self.upload_workspace().data["workspace_id"]
        response = self.client.post(
            "/api/v1/literature/chat/",
            {
                "workspace_id": workspace_id,
                "question": "What dissolution method was used?",
                "mode": "local",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["provider"], "local-evidence")
        self.assertIn("study.pdf | PAGE 1", response.data["answer"])
        self.assertEqual(LiteratureMessage.objects.count(), 2)

    def test_external_ai_requires_explicit_consent(self):
        workspace_id = self.upload_workspace().data["workspace_id"]
        response = self.client.post(
            "/api/v1/literature/chat/",
            {
                "workspace_id": workspace_id,
                "question": "Summarize the findings.",
                "mode": "gemini",
                "allow_external_ai": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
