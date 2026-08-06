from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


class StabilityAnalysisApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            "stability-scientist", password="Strong-Test-Password-42"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_estimates_shelf_life_and_future_response(self):
        observations = []
        for formulation, intercept, slope in (("F1", 0.03, 0.006), ("F2", 0.04, 0.007)):
            for batch_offset in (0.0, 0.002):
                for month in (0, 3, 6, 9, 12):
                    observations.append({
                        "month": month,
                        "formulation": formulation,
                        "batch": f"{formulation}-B{batch_offset}",
                        "response": intercept + batch_offset + slope * month,
                    })

        response = self.client.post("/api/v1/doe/stability/analyze/", {
            "observations": observations,
            "response_name": "Unknown Impurity (%)",
            "upper_limit": 0.2,
            "confidence_level": 0.95,
            "pooling_alpha": 0.25,
            "maximum_prediction_month": 36,
            "prediction_month": 18,
            "prediction_formulation": "F1",
        }, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["formulations"], ["F1", "F2"])
        self.assertEqual(len(response.data["shelf_lives"]), 2)
        self.assertTrue(response.data["curves"]["F1"])
        self.assertEqual(response.data["prediction"]["formulation"], "F1")
        self.assertGreater(response.data["r_squared"], 0.9)

    def test_requires_a_specification_limit(self):
        response = self.client.post("/api/v1/doe/stability/analyze/", {
            "observations": [
                {"month": 0, "formulation": "F1", "response": 1},
                {"month": 3, "formulation": "F1", "response": 2},
                {"month": 6, "formulation": "F1", "response": 3},
            ],
        }, format="json")
        self.assertEqual(response.status_code, 400)
