from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .domain import classify_bcs, simulate_profile, run_pbbm_web_simulation
from .models import DissolutionRun
from .serializers import DissolutionSimulationSerializer


class SimulateDissolutionView(APIView):
    @transaction.atomic
    def post(self, request):
        serializer = DissolutionSimulationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        mode = data.get("mode", "standard")
        try:
            if mode == "pbbm":
                pbbm_res = run_pbbm_web_simulation(
                    dose_mg=data["dose_mg"],
                    molecular_weight=data["molecular_weight"],
                    s0_mg_ml=data.get("s0_mg_ml", 0.05),
                    pka=data.get("pka"),
                    ion_type=data.get("ion_type", "acid"),
                    d50_um=data.get("particle_diameter_um", 25.0),
                    peff_cm_s=data.get("peff_cm_s", 0.00015),
                    cl_l_hr=data.get("cl_l_hr", 6.0),
                    vc_l=data.get("vc_l", 12.0),
                    duration_hr=data.get("duration_hr", 24.0),
                )
                bcs = classify_bcs(
                    data["dose_mg"], data["molecular_weight"], data.get("log_s", -3.0),
                    data.get("hia_percent"),
                )
                response_payload = {
                    "engine_version": "2.0.0-pbbm",
                    "mode": "pbbm",
                    "bcs": bcs,
                    "metrics": pbbm_res["metrics"],
                    "profile": pbbm_res["profile"],
                    "warnings": pbbm_res["warnings"],
                }
            else:
                bcs = classify_bcs(
                    data["dose_mg"], data["molecular_weight"], data.get("log_s", -3.0),
                    data.get("hia_percent"),
                )
                profile, metrics, warnings = simulate_profile(
                    dose_mg=data["dose_mg"],
                    molecular_weight=data["molecular_weight"],
                    log_s=data.get("log_s", -3.0),
                    particle_diameter_um=data["particle_diameter_um"],
                    drug_density_g_cm3=data["drug_density_g_cm3"],
                    medium_volume_ml=data["medium_volume_ml"],
                    boundary_layer_um=data["boundary_layer_um"],
                    duration_min=data["duration_min"],
                    output_points=data["output_points"],
                )
                response_payload = {
                    "engine_version": "1.0.0",
                    "mode": "standard",
                    "bcs": bcs,
                    "metrics": metrics,
                    "profile": profile,
                    "warnings": warnings,
                }
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

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
