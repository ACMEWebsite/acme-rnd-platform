from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.characterization.models import CharacterizationRun


class CharacterizationApiTests(APITestCase):
    def setUp(self):
        user = get_user_model().objects.create_user("characterization-user", password="Test-password-42")
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_characterization_run_is_audited(self):
        record = {"source": "PubChem", "record_id": "CID 702", "data": {"Molecular Weight": {"value": 46.07, "source": "PubChem", "link": "https://example.test"}}}
        response = self.client.post("/api/v1/characterization/runs/", {"api_name": "Ethanol", "selected_properties": ["Molecular Weight"], "selected_records": [record]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["results"][0]["status"], "found")
        self.assertEqual(CharacterizationRun.objects.count(), 1)

    def test_catalog_contains_only_requested_tabs(self):
        response = self.client.get("/api/v1/characterization/catalog/")
        self.assertEqual(response.status_code, 200)
        groups = response.data["property_groups"]
        self.assertEqual(
            list(groups),
            ["Identity", "Physical Properties", "Chemical Properties", "Solubility Profiling"],
        )
        self.assertIn("BCS Classification", groups["Solubility Profiling"])
        self.assertNotIn("Permeability", [item for values in groups.values() for item in values])

    @override_settings(TAVILY_API_KEY="configured-for-test")
    @patch("apps.characterization.services.engine.search_property_evidence")
    def test_missing_property_uses_cited_web_evidence(self, search_property_evidence):
        search_property_evidence.return_value = {
            "value": "A cited stability overview.",
            "overview": "A cited stability overview.",
            "evidence": [{
                "title": "Stability study",
                "url": "https://pubmed.ncbi.nlm.nih.gov/example",
                "content": "Study abstract.",
                "source_type": "Journal",
            }],
        }
        response = self.client.post(
            "/api/v1/characterization/runs/",
            {
                "api_name": "Example API",
                "selected_properties": ["Photostability"],
                "selected_records": [{"source": "PubChem", "record_id": "CID 1", "data": {}}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        result = response.data["results"][0]
        self.assertEqual(result["status"], "web_evidence")
        self.assertEqual(result["sources"], ["Journal"])
        self.assertEqual(result["evidence"][0]["title"], "Stability study")
