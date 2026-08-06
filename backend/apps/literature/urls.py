from django.urls import path

from .views import (
    LiteratureAnalyzeView,
    LiteratureChatView,
    LiteratureWorkspaceDetailView,
)


urlpatterns = [
    path("documents/analyze/", LiteratureAnalyzeView.as_view(), name="analyze"),
    path("chat/", LiteratureChatView.as_view(), name="chat"),
    path(
        "workspaces/<int:pk>/",
        LiteratureWorkspaceDetailView.as_view(),
        name="workspace-detail",
    ),
]
