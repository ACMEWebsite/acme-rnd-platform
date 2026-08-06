from django.urls import path
from .views import (
    AdminUserCreateView,
    AdminUserDeleteView,
    AdminUserListView,
    AdminUserResetPasswordView,
    AdminUserToggleStatusView,
    ChangePasswordView,
    CurrentUserView,
    LoginView,
    UpdateProfileView,
)

urlpatterns = [
    path("token/", LoginView.as_view(), name="accounts-login"),
    path("me/", CurrentUserView.as_view(), name="accounts-me"),
    path("me/profile/", UpdateProfileView.as_view(), name="accounts-update-profile"),
    path("me/change-password/", ChangePasswordView.as_view(), name="accounts-change-password"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("admin/users/create/", AdminUserCreateView.as_view(), name="admin-user-create"),
    path("admin/users/<int:user_id>/toggle-status/", AdminUserToggleStatusView.as_view(), name="admin-user-toggle-status"),
    path("admin/users/<int:user_id>/reset-password/", AdminUserResetPasswordView.as_view(), name="admin-user-reset-password"),
    path("admin/users/<int:user_id>/delete/", AdminUserDeleteView.as_view(), name="admin-user-delete"),
]
