from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .domain import classify_bcs, simulate_profile
from .models import DissolutionRun
from .serializers import DissolutionSimulationSerializer


class SimulateDissolutionView(APIView):
    @transaction.atomic
    def post(self, request):
        serializer = DissolutionSimulationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            bcs = classify_bcs(
                data["dose_mg"], data["molecular_weight"], data["log_s"],
                data.get("hia_percent"),
            )
            profile, metrics, warnings = simulate_profile(
                dose_mg=data["dose_mg"],
                molecular_weight=data["molecular_weight"],
                log_s=data["log_s"],
                particle_diameter_um=data["particle_diameter_um"],
                drug_density_g_cm3=data["drug_density_g_cm3"],
                medium_volume_ml=data["medium_volume_ml"],
                boundary_layer_um=data["boundary_layer_um"],
                duration_min=data["duration_min"],
                output_points=data["output_points"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        response_payload = {
            "engine_version": "1.0.0",
            "bcs": bcs,
            "metrics": metrics,
            "profile": profile,
            "warnings": warnings,
        }
        run = DissolutionRun.objects.create(
            created_by=request.user,
            request_payload=dict(data),
            response_payload=response_payload,
        )
        return Response({"run_id": run.pk, **response_payload}, status=status.HTTP_201_CREATED)


class RecentDissolutionRunsView(APIView):
    def get(self, request):
        runs = DissolutionRun.objects.filter(created_by=request.user)[:20]
        return Response([
            {
                "run_id": run.pk,
                "created_at": run.created_at,
                "engine_version": run.engine_version,
                "request": run.request_payload,
                "result": run.response_payload,
            }
            for run in runs
        ])
