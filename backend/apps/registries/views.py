import re
from urllib.parse import urljoin, urlparse

import requests
from django.http import StreamingHttpResponse
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RegistrySearch
from .serializers import MhraQuerySerializer, RegistryQuerySerializer
from .services.live import dailymed_details, dailymed_search, mhra_search
from .services.local_data import iid_search, orange_book_search


class BaseRegistryView(APIView):
    registry = ""
    def audit(self, request, query, count):
        RegistrySearch.objects.create(created_by=request.user, registry=self.registry, query=query, result_count=count)


class OrangeBookSearchView(BaseRegistryView):
    registry = "orange_book"
    @transaction.atomic
    def get(self, request):
        serializer = RegistryQuerySerializer(data=request.query_params); serializer.is_valid(raise_exception=True)
        rows = orange_book_search(serializer.validated_data["query"]); self.audit(request, serializer.validated_data["query"], len(rows))
        return Response({"source": "Local FDA Orange Book snapshot", "reference_url": "https://www.accessdata.fda.gov/scripts/cder/ob/index.cfm", "records": rows})


class IidSearchView(BaseRegistryView):
    registry = "iid"
    @transaction.atomic
    def get(self, request):
        serializer = RegistryQuerySerializer(data=request.query_params); serializer.is_valid(raise_exception=True)
        rows = iid_search(serializer.validated_data["query"]); self.audit(request, serializer.validated_data["query"], len(rows))
        routes = len({row.get("ROUTE") for row in rows}); forms = len({row.get("DOSAGE_FORM") for row in rows})
        return Response({"source": "Local FDA IID snapshot", "records": rows, "statistics": {"records": len(rows), "routes": routes, "dosage_forms": forms}})


class DailyMedSearchView(BaseRegistryView):
    registry = "dailymed"
    @transaction.atomic
    def get(self, request):
        serializer = RegistryQuerySerializer(data=request.query_params); serializer.is_valid(raise_exception=True)
        rows = dailymed_search(serializer.validated_data["query"]); self.audit(request, serializer.validated_data["query"], len(rows))
        return Response({"source": "DailyMed live API", "labels": rows})


class DailyMedDetailsView(APIView):
    def get(self, request, setid):
        return Response(dailymed_details(setid))


class MhraSearchView(BaseRegistryView):
    registry = "mhra"
    @transaction.atomic
    def get(self, request):
        serializer = MhraQuerySerializer(data=request.query_params); serializer.is_valid(raise_exception=True)
        result = mhra_search(serializer.validated_data["query"], serializer.validated_data["document_types"]); self.audit(request, serializer.validated_data["query"], result["count"])
        return Response(result)


def _registry_document_allowed(url):
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return False
    if parsed.hostname == "dailymed.nlm.nih.gov":
        return parsed.path.lower() == "/dailymed/downloadpdffile.cfm"
    return bool(
        re.fullmatch(r"mhraproducts\d+\.blob\.core\.windows\.net", parsed.hostname or "")
        and parsed.path.startswith("/docs/")
    )


class RegistryDocumentView(APIView):
    def get(self, request):
        document_url = request.query_params.get("url", "").strip()
        if not _registry_document_allowed(document_url):
            return Response(
                {"detail": "The registry document URL is not permitted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upstream = None
        current_url = document_url
        try:
            for _ in range(4):
                if not _registry_document_allowed(current_url):
                    raise ValueError("The registry document redirect is not permitted.")
                upstream = requests.get(
                    current_url,
                    timeout=30,
                    stream=True,
                    allow_redirects=False,
                )
                if upstream.is_redirect or upstream.is_permanent_redirect:
                    location = upstream.headers.get("Location", "")
                    upstream.close()
                    current_url = urljoin(current_url, location)
                    upstream = None
                    continue
                upstream.raise_for_status()
                break
            else:
                raise ValueError("Too many registry document redirects.")
        except (requests.RequestException, ValueError) as exc:
            if upstream is not None:
                upstream.close()
            return Response(
                {"detail": f"Registry document fetch failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        def stream():
            try:
                yield from upstream.iter_content(chunk_size=64 * 1024)
            finally:
                upstream.close()

        response = StreamingHttpResponse(stream(), content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="Registry_Document.pdf"'
        response["X-Content-Type-Options"] = "nosniff"
        return response
