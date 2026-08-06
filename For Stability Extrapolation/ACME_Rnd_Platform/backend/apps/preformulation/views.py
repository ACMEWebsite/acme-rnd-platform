from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompatibilityRun
from .serializers import CompatibilitySerializer
from .services.catalog import EXCIPIENTS
from .services.engine import run_screen


class ExcipientCatalogView(APIView):
    def get(self, request):
        return Response({"excipients": [{"name": name, **profile} for name, profile in EXCIPIENTS.items()]})


class CompatibilityRunView(APIView):
    @transaction.atomic
    def post(self, request):
        serializer = CompatibilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = run_screen(data["api_input"], data["excipients"], data["include_pubmed"])
        run = CompatibilityRun.objects.create(created_by=request.user, api_input=data["api_input"], resolved_smiles=result["drug_profile"]["smiles"], excipients=data["excipients"], result=result, warnings=result["warnings"])
        return Response({"run_id": run.pk, **result}, status=status.HTTP_201_CREATED)
