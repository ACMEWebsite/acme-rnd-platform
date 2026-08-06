from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase


class CompatibilityApiTests(APITestCase):
    def setUp(self):
        user = get_user_model().objects.create_user("compatibility-user", password="Test-password-42")
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    @patch("apps.preformulation.services.engine._pubmed", return_value=[])
    def test_lactose_and_amine_flags_maillard_risk(self, _pubmed):
        response = self.client.post("/api/v1/preformulation/compatibility/runs/", {"api_input": "CCN", "excipients": ["Lactose Monohydrate (Fine Powder)"], "include_pubmed": False}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recommended_risk"], "High")
        self.assertEqual(response.data["rule_based_evidence"][0]["reaction_type"], "Maillard reaction")
