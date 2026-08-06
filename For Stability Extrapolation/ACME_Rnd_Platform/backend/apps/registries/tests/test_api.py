from unittest.mock import patch
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.registries.models import RegistrySearch


class RegistryApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            "registry-scientist",
            password="Strong-Test-Password-42",
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    @patch("apps.registries.views.mhra_search")
    def test_mhra_search_returns_documents_and_audits_total(self, search):
        search.return_value = {
            "source": "UK MHRA Products public search",
            "results": [
                {
                    "document": "PAR",
                    "product": "FAMOTIDINE",
                    "description": "FAMOTIDINE 40 MG FILM-COATED TABLETS",
                    "context": "Public Assessment Report",
                    "pdf_url": "https://example.test/famotidine.pdf",
                }
            ],
            "count": 37,
            "returned_count": 1,
            "truncated": True,
            "portal_url": "https://products.mhra.gov.uk/search/?search=Famotidine",
            "document_types": ["PAR"],
        }

        response = self.client.get(
            "/api/v1/registries/mhra/",
            {"query": "Famotidine", "document_types": ["PAR"]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 37)
        self.assertEqual(response.data["results"][0]["document"], "PAR")
        audit = RegistrySearch.objects.get(registry="mhra")
        self.assertEqual(audit.result_count, 37)

    @patch("apps.registries.views.requests.get")
    def test_registry_document_is_proxied_for_inline_preview(self, get):
        upstream = MagicMock()
        upstream.is_redirect = False
        upstream.is_permanent_redirect = False
        upstream.iter_content.return_value = [b"%PDF-1.7 registry"]
        get.return_value = upstream

        response = self.client.get(
            "/api/v1/registries/document/",
            {
                "url": (
                    "https://mhraproducts4853.blob.core.windows.net/"
                    "docs/example-document"
                )
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-1.7 registry")

    def test_registry_document_rejects_unapproved_hosts(self):
        response = self.client.get(
            "/api/v1/registries/document/",
            {"url": "https://example.com/document.pdf"},
        )
        self.assertEqual(response.status_code, 400)
