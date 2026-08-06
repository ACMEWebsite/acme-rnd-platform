from django.urls import path
from .views import CharacterizationCatalogView, CharacterizationRunView, CharacterizationSearchView

urlpatterns = [
    path("catalog/", CharacterizationCatalogView.as_view()),
    path("search/", CharacterizationSearchView.as_view()),
    path("runs/", CharacterizationRunView.as_view()),
]
