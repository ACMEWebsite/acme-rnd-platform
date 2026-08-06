from django.urls import path
from .views import RecentDissolutionRunsView, SimulateDissolutionView

urlpatterns = [
    path("simulate/", SimulateDissolutionView.as_view(), name="dissolution-simulate"),
    path("runs/", RecentDissolutionRunsView.as_view(), name="dissolution-runs"),
]
