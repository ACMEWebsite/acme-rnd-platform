from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.authtoken.views import obtain_auth_token


def health(request):
    return JsonResponse({"status": "ok", "service": "acme-rnd-api"})


urlpatterns = [
    path("health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/token/", obtain_auth_token, name="api-token"),
    path("api/v1/dissolution/", include("apps.dissolution.urls")),
    path("api/v1/pharmacokinetics/", include("apps.pharmacokinetics.urls")),
    path("api/v1/literature/", include("apps.literature.urls")),
    path("api/v1/characterization/", include("apps.characterization.urls")),
    path("api/v1/preformulation/", include("apps.preformulation.urls")),
    path("api/v1/registries/", include("apps.registries.urls")),
    path("api/v1/doe/", include("apps.doe.urls")),
]
