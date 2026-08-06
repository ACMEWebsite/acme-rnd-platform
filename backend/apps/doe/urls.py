from django.urls import path
from .views import GenerateDesignView,RankTrialsView,StabilityAnalysisView
urlpatterns=[
    path("stability/analyze/", StabilityAnalysisView.as_view()),
    path("designs/",GenerateDesignView.as_view()),
    path("rank/",RankTrialsView.as_view()),
]
