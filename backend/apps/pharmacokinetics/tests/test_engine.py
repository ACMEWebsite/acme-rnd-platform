from unittest.mock import patch

from django.test import SimpleTestCase

from apps.pharmacokinetics.integrations.engine import run_workflow
from apps.pharmacokinetics.integrations.psg import parse_document_title
from apps.pharmacokinetics.integrations.psg_live import _GuidanceTableParser


class PharmacokineticsEngineTests(SimpleTestCase):
    @patch(
        "apps.pharmacokinetics.integrations.engine.predict_pka",
        return_value={
            "acid_pkas": [13.84],
            "base_pkas": [2.9, 8.14],
            "source": "graph neural network",
            "error": None,
        },
    )
    @patch(
        "apps.pharmacokinetics.integrations.engine.find_by_smiles",
        return_value=None,
    )
    def test_molgpka_values_are_displayed_without_product_name(self, _find, _pka):
        result = run_workflow("CCN")
        values = {item["property"]: item["value"] for item in result["predictions"]}
        self.assertEqual(values["pKa acid"], "13.84 (graph neural network)")
        self.assertEqual(values["pKa basic"], "8.14 (graph neural network)")
        self.assertNotIn("MolGpKa", values["log D (pH 7.4)"])

    @patch(
        "apps.pharmacokinetics.integrations.engine.predict_pka",
        return_value={
            "acid_pkas": [],
            "base_pkas": [],
            "source": "local heuristic",
            "error": "offline",
        },
    )
    @patch(
        "apps.pharmacokinetics.integrations.engine.find_by_smiles",
        return_value=None,
    )
    def test_local_pka_fallback_has_no_heuristic_label(self, _find, _pka):
        result = run_workflow("CCN")
        values = {item["property"]: item["value"] for item in result["predictions"]}
        self.assertNotIn("heuristic", values["pKa acid"])
        self.assertNotIn("heuristic", values["pKa basic"])
        self.assertNotIn("heuristic", values["log D (pH 7.4)"])

    @patch(
        "apps.pharmacokinetics.integrations.engine.find_by_smiles",
        return_value=None,
    )
    def test_direct_smiles_returns_24_properties(self, _find):
        result = run_workflow("CCO")
        self.assertEqual(result["smiles"], "CCO")
        self.assertEqual(len(result["predictions"]), 24)
        self.assertEqual(result["predictions"][0]["category"], "Absorption")
        self.assertEqual(result["predictions"][-1]["property"], "pKa basic")

    @patch(
        "apps.pharmacokinetics.integrations.engine.find_by_smiles",
        return_value={
            "record_name": "Ethanol",
            "canonical_smiles": "CCO",
            "biological_half_life": "Approximately 3-5 hours",
        },
    )
    def test_pubchem_half_life_is_inserted_after_clearance(self, _find):
        result = run_workflow("CCO")

        properties = [
            item["property"]
            for item in result["predictions"]
        ]

        clearance_index = properties.index("Clearance")
        half_life = result["predictions"][clearance_index + 1]

        self.assertEqual(len(result["predictions"]), 25)
        self.assertEqual(
            half_life["category"],
            "Excretion",
        )
        self.assertEqual(
            half_life["property"],
            "Biological Half-Life",
        )
        self.assertEqual(
            half_life["value"],
            "Approximately 3-5 hours",
        )
        self.assertEqual(
            half_life["source"],
            "PubChem PUG View",
        )

    def test_invalid_structure_is_rejected_when_name_lookup_fails(self):
        with patch(
            "apps.pharmacokinetics.integrations.engine.resolve_name",
            return_value=None,
        ):
            with self.assertRaises(ValueError):
                run_workflow("not-a-real-compound")

    def test_psg_title_parser(self):
        result = parse_document_title(
            "PSG_020687 - Final Guidance on Mifepristone "
            "re Product-Specific Guidance"
        )
        self.assertEqual(result["psg_number"], "020687")
        self.assertEqual(result["active_ingredient"], "Mifepristone")
        self.assertEqual(result["guidance_type"], "Final")

    def test_fda_live_table_parser_handles_current_and_legacy_pdf_names(self):
        parser = _GuidanceTableParser()
        parser.feed(
            """
            <table id="drugTable"><tbody>
              <tr class="drugData">
                <td>Mifepristone</td>
                <td><a href="https://www.accessdata.fda.gov/drugsatfda_docs/psg/PSG_202107.pdf">PDF</a></td>
                <td>Draft</td><td>Oral</td><td>Tablet</td><td>202107</td><td>11/2019</td>
              </tr>
              <tr class="drugData">
                <td>Misoprostol</td>
                <td><a href="https://www.accessdata.fda.gov/drugsatfda_docs/psg/Misoprostol_tab_19268_RC2-10.pdf">PDF</a></td>
                <td>Draft</td><td>Oral</td><td>Tablet</td><td>019268</td><td>02/2010</td>
              </tr>
            </tbody></table>
            """
        )
        self.assertEqual([item["psg_number"] for item in parser.results], ["202107", "19268"])
