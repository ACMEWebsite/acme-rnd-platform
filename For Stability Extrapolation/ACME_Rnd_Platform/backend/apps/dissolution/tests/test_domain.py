from django.test import SimpleTestCase
from apps.dissolution.domain import classify_bcs, simulate_profile


class DissolutionDomainTests(SimpleTestCase):
    def test_bcs_class_two(self):
        result = classify_bcs(100, 250, -4, 95)
        self.assertEqual(result["class"], "Class II")

    def test_profile_is_monotonic_and_bounded(self):
        profile, metrics, warnings = simulate_profile(
            dose_mg=100, molecular_weight=250, log_s=-3, output_points=30
        )
        values = [row["dissolved_percent"] for row in profile]
        self.assertTrue(all(a <= b for a, b in zip(values, values[1:])))
        self.assertGreaterEqual(min(values), 0)
        self.assertLessEqual(max(values), 100)
        self.assertIn("sink_conditions", metrics)
        self.assertTrue(warnings)

    def test_rejects_non_positive_dose(self):
        with self.assertRaises(ValueError):
            simulate_profile(dose_mg=0, molecular_weight=250, log_s=-3)
