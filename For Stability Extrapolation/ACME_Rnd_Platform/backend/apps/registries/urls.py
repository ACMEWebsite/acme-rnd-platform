from django.urls import path
from .views import DailyMedDetailsView, DailyMedSearchView, IidSearchView, MhraSearchView, OrangeBookSearchView, RegistryDocumentView
urlpatterns = [path("orange-book/", OrangeBookSearchView.as_view()), path("iid/", IidSearchView.as_view()), path("dailymed/", DailyMedSearchView.as_view()), path("dailymed/<str:setid>/", DailyMedDetailsView.as_view()), path("mhra/", MhraSearchView.as_view()), path("document/", RegistryDocumentView.as_view())]
