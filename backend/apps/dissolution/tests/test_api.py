from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from apps.dissolution.models import DissolutionRun


class DissolutionApiTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("scientist", password="Strong-Test-Password-42")
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_simulation_is_authenticated_and_audited(self):
        response = self.client.post("/api/v1/dissolution/simulate/", {
            "dose_mg": 100, "molecular_weight": 250.2, "log_s": -3.1,
            "hia_percent": 92, "particle_diameter_um": 50,
            "medium_volume_ml": 900,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["bcs"]["class"], "Class II")
        self.assertTrue(response.data["profile"])
        self.assertEqual(DissolutionRun.objects.count(), 1)

    def test_invalid_input_returns_400(self):
        response = self.client.post("/api/v1/dissolution/simulate/", {
            "dose_mg": -1, "molecular_weight": 250, "log_s": -3
        }, format="json")
        self.assertEqual(response.status_code, 400)
