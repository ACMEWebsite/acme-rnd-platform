from urllib.parse import urlparse

import requests
from django.db import transaction
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .integrations.engine import run_workflow
from .integrations.psg import (
    last_sync_event,
    search_local,
    serialize_guidance,
    sync_psg_dataset,
)
from .integrations.psg_live import live_search
from .interpretations import decorate_predictions
from .models import PharmacokineticsRun, PsgGuidance
from .serializers import PharmacokineticsPredictionSerializer, PsgSearchSerializer


class PredictPharmacokineticsView(APIView):
    @transaction.atomic
    def post(self, request):
        serializer = PharmacokineticsPredictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = run_workflow(
                data["compound_input"],
                include_pubchem_enrichment=data["include_pubchem_enrichment"],
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        predictions = decorate_predictions(result["predictions"])
        run = PharmacokineticsRun.objects.create(
            created_by=request.user,
            compound_input=data["compound_input"],
            compound_name=result["compound_name"],
            resolved_smiles=result["smiles"],
            predictions=predictions,
            pubchem_record=result["pubchem_record"],
            warnings=result["warnings"],
        )
        return Response(
            {
                "run_id": run.pk,
                "engine_version": run.engine_version,
                "compound_name": run.compound_name,
                "smiles": run.resolved_smiles,
                "pubchem_record": run.pubchem_record,
                "predictions": run.predictions,
                "warnings": run.warnings,
            },
            status=status.HTTP_201_CREATED,
        )


class RecentPharmacokineticsRunsView(APIView):
    def get(self, request):
        runs = PharmacokineticsRun.objects.filter(created_by=request.user)[:20]
        return Response(
            [
                {
                    "run_id": run.pk,
                    "compound_input": run.compound_input,
                    "compound_name": run.compound_name,
                    "smiles": run.resolved_smiles,
                    "created_at": run.created_at,
                }
                for run in runs
            ]
        )


class PsgSearchView(APIView):
    def get(self, request):
        serializer = PsgSearchSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["q"]
        live_results = live_search(query)
        if live_results is None:
            results = [serialize_guidance(item) for item in search_local(query)]
            source = "synced"
        else:
            results = live_results
            source = "live"
        last_sync = last_sync_event()
        return Response(
            {
                "query": query,
                "count": len(results),
                "source": source,
                "results": results,
                "dataset_size": PsgGuidance.objects.count(),
                "last_synced_at": last_sync.completed_at if last_sync else None,
                "warning": "",
            }
        )


class PsgSyncView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        try:
            event = sync_psg_dataset()
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {
                "status": event.status,
                "records_received": event.records_received,
                "completed_at": event.completed_at,
            }
        )


class PsgDocumentView(APIView):
    def get(self, request, pk=None):
        if pk is None:
            pdf_url = request.query_params.get("url", "").strip()
            filename = "FDA_Product_Specific_Guidance.pdf"
        else:
            try:
                guidance = PsgGuidance.objects.get(pk=pk)
            except PsgGuidance.DoesNotExist:
                return Response(
                    {"detail": "Guidance not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            pdf_url = guidance.pdf_url
            filename = f"PSG_{guidance.psg_number}.pdf"

        parsed = urlparse(pdf_url)
        if (
            parsed.scheme != "https"
            or parsed.hostname != "www.accessdata.fda.gov"
            or not parsed.path.lower().startswith("/drugsatfda_docs/psg/")
            or not parsed.path.lower().endswith(".pdf")
        ):
            return Response(
                {"detail": "The FDA document URL is not permitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            upstream = requests.get(pdf_url, timeout=30, stream=True)
            upstream.raise_for_status()
        except requests.RequestException as exc:
            return Response(
                {"detail": f"FDA document fetch failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        def stream():
            try:
                yield from upstream.iter_content(chunk_size=64 * 1024)
            finally:
                upstream.close()

        response = StreamingHttpResponse(stream(), content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response
