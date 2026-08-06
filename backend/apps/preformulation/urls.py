from django.urls import path
from .views import CompatibilityRunView, ExcipientCatalogView

urlpatterns = [path("excipients/", ExcipientCatalogView.as_view()), path("compatibility/runs/", CompatibilityRunView.as_view())]
