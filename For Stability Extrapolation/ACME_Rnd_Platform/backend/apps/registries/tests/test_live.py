from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.registries.services.live import mhra_search
from apps.registries.services.local_data import orange_book_search


class MhraLiveServiceTests(SimpleTestCase):
    @patch("apps.registries.services.live._mhra_search_config")
    @patch("apps.registries.services.live.requests.get")
    def test_maps_official_search_results(self, get, config):
        config.return_value = ("official-search", "public-browser-key")
        response = MagicMock()
        response.json.return_value = {
            "@odata.count": 1,
            "value": [
                {
                    "doc_type": "Par",
                    "product_name": "FAMOTIDINE",
                    "title": "FAMOTIDINE 40 MG FILM-COATED TABLETS",
                    "metadata_storage_path": "https://example.test/famotidine.pdf",
                    "@search.highlights": {
                        "content": ["Public <em>Assessment</em> Report"]
                    },
                }
            ],
        }
        get.return_value = response

        result = mhra_search("Famotidine", ["PAR"])

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["results"][0]["document"], "PAR")
        self.assertEqual(result["results"][0]["context"], "Public Assessment Report")
        self.assertTrue(result["results"][0]["pdf_url"].endswith("famotidine.pdf"))
        response.raise_for_status.assert_called_once()


class OrangeBookServiceTests(SimpleTestCase):
    @patch("apps.registries.services.local_data._orange_book")
    def test_search_returns_only_rld_records(self, orange_book):
        common = {
            "Ingredient": "TEST DRUG",
            "Trade_Name": "REFERENCE BRAND",
            "Appl_Type": "N",
            "Appl_No": "123456",
            "DF;Route": "TABLET;ORAL",
            "Strength": "10 MG",
            "TE_Code": "AB",
            "RS": "No",
            "Applicant_Full_Name": "TEST APPLICANT",
            "Approval_Date": "Jan 1, 2020",
        }
        orange_book.return_value = [
            {**common, "RLD": "No"},
            {**common, "RLD": "Yes", "Strength": "20 MG"},
        ]

        rows = orange_book_search("Test Drug")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["rld"], "Yes")
        self.assertEqual(rows[0]["strength"], "20 MG")
