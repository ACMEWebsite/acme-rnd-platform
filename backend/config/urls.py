from django.contrib import admin
from django.http import JsonResponse, HttpResponse
from django.urls import include, path, re_path
from django.conf import settings
from rest_framework.authtoken.views import obtain_auth_token


def health(request):
    return JsonResponse({"status": "ok", "service": "acme-rnd-api"})


def serve_spa(request):
    index_file = settings.BASE_DIR.parent / "frontend" / "dist" / "index.html"
    if index_file.exists():
        with open(index_file, "r", encoding="utf-8") as f:
            return HttpResponse(f.read(), content_type="text/html")
    return JsonResponse({"status": "ok", "service": "acme-rnd-api"})


urlpatterns = [
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/dissolution/", include("apps.dissolution.urls")),
    path("api/v1/pharmacokinetics/", include("apps.pharmacokinetics.urls")),
    path("api/v1/literature/", include("apps.literature.urls")),
    path("api/v1/characterization/", include("apps.characterization.urls")),
    path("api/v1/preformulation/", include("apps.preformulation.urls")),
    path("api/v1/registries/", include("apps.registries.urls")),
    path("api/v1/doe/", include("apps.doe.urls")),
    re_path(r"^.*$", serve_spa),
]
