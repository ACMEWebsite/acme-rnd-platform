from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CharacterizationRun
from .serializers import CharacterizationRunSerializer, CharacterizationSearchSerializer
from .services.catalog import PROPERTY_GROUPS
from .services.engine import characterize
from .services.sources import find_records


class CharacterizationCatalogView(APIView):
    def get(self, request):
        return Response({"property_groups": PROPERTY_GROUPS})


class CharacterizationSearchView(APIView):
    def get(self, request):
        serializer = CharacterizationSearchSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            records = find_records(serializer.validated_data["query"])
        except Exception:
            records = []
        return Response({"records": records})


class CharacterizationRunView(APIView):
    @transaction.atomic
    def post(self, request):
        serializer = CharacterizationRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        allowed = {prop for props in PROPERTY_GROUPS.values() for prop in props}
        properties = [prop for prop in data["selected_properties"] if prop in allowed]
        if not properties:
            return Response({"detail": "No recognized properties were selected."}, status=status.HTTP_400_BAD_REQUEST)
        results, warnings = characterize(data["api_name"], properties, data["selected_records"])
        run = CharacterizationRun.objects.create(
            created_by=request.user, api_name=data["api_name"], selected_properties=properties,
            selected_records=data["selected_records"], results=results, warnings=warnings,
        )
        return Response({"run_id": run.pk, "results": results, "warnings": warnings}, status=status.HTTP_201_CREATED)
