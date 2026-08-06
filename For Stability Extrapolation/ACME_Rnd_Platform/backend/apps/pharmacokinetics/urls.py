from django.urls import path

from .views import (
    PredictPharmacokineticsView,
    PsgDocumentView,
    PsgSearchView,
    PsgSyncView,
    RecentPharmacokineticsRunsView,
)


urlpatterns = [
    path("predict/", PredictPharmacokineticsView.as_view(), name="pk-predict"),
    path("runs/", RecentPharmacokineticsRunsView.as_view(), name="pk-runs"),
    path("psg/search/", PsgSearchView.as_view(), name="psg-search"),
    path("psg/sync/", PsgSyncView.as_view(), name="psg-sync"),
    path("psg/document/", PsgDocumentView.as_view(), name="psg-live-document"),
    path("psg/<int:pk>/document/", PsgDocumentView.as_view(), name="psg-document"),
]
