from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.pharmacokinetics.models import PharmacokineticsRun, PsgGuidance


class PharmacokineticsApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            "pk-scientist",
            password="Strong-Test-Password-42",
        )
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    @patch("apps.pharmacokinetics.views.run_workflow")
    def test_prediction_is_audited(self, workflow):
        workflow.return_value = {
            "compound_name": "Ethanol",
            "smiles": "CCO",
            "pubchem_record": {"cid": 702},
            "predictions": [
                {
                    "category": "Molecule Properties",
                    "property": "log P",
                    "value": "-0.3",
                    "source": "Local RDKit/QSAR",
                }
            ],
            "warnings": ["Screening model."],
        }
        response = self.client.post(
            "/api/v1/pharmacokinetics/predict/",
            {"compound_input": "CCO"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["compound_name"], "Ethanol")
        self.assertIn("interpretation", response.data["predictions"][0])
        self.assertEqual(PharmacokineticsRun.objects.count(), 1)

    @patch("apps.pharmacokinetics.views.live_search", return_value=None)
    def test_psg_search_uses_synced_database_when_fda_is_unavailable(self, _live):
        PsgGuidance.objects.create(
            psg_number="020687",
            active_ingredient="Mifepristone",
            guidance_type="Final",
            regulations_document_id="FDA-TEST-1",
            pdf_url=(
                "https://www.accessdata.fda.gov/drugsatfda_docs/psg/"
                "PSG_020687.pdf"
            ),
        )
        response = self.client.get(
            "/api/v1/pharmacokinetics/psg/search/?q=Mifepristone"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["psg_number"], "020687")

    @patch(
        "apps.pharmacokinetics.views.live_search",
        return_value=[
            {
                "id": None,
                "active_ingredient": "Misoprostol",
                "psg_number": "19268",
                "guidance_type": "Draft",
                "posted_date": "02/2010",
                "pdf_url": "https://www.accessdata.fda.gov/drugsatfda_docs/psg/Misoprostol_tab_19268_RC2-10.pdf",
            }
        ],
    )
    def test_psg_search_prefers_complete_fda_results(self, _live):
        response = self.client.get(
            "/api/v1/pharmacokinetics/psg/search/?q=Misoprostol"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["source"], "live")
        self.assertEqual(response.data["results"][0]["psg_number"], "19268")

    @patch("apps.pharmacokinetics.views.requests.get")
    def test_live_fda_document_is_proxied_for_inline_preview(self, get):
        upstream = MagicMock()
        upstream.iter_content.return_value = [b"%PDF-1.7 test"]
        get.return_value = upstream
        response = self.client.get(
            "/api/v1/pharmacokinetics/psg/document/",
            {
                "url": (
                    "https://www.accessdata.fda.gov/drugsatfda_docs/psg/"
                    "PSG_202107.pdf"
                )
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-1.7 test")

    def test_live_document_proxy_rejects_non_fda_urls(self):
        response = self.client.get(
            "/api/v1/pharmacokinetics/psg/document/",
            {"url": "https://example.com/not-an-fda-document.pdf"},
        )
        self.assertEqual(response.status_code, 400)
