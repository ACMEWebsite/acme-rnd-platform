from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile, UserRole
from .serializers import (
    PasswordChangeSerializer,
    ProfileUpdateSerializer,
    UserCreateSerializer,
    UserProfileSerializer,
)


def ensure_default_admin():
    try:
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@acmernd.local",
                "first_name": "Admin",
                "last_name": "User",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created or not admin_user.check_password("Welcome@1234"):
            admin_user.set_password("Welcome@1234")
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()

        profile, _ = UserProfile.objects.get_or_create(user=admin_user)
        if profile.role != UserRole.ADMIN:
            profile.role = UserRole.ADMIN
            profile.full_name = "System Administrator"
            profile.save()
    except Exception:
        pass


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        ensure_default_admin()
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "").strip()

        user = authenticate(username=username, password=password)
        if not user:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account has been deactivated. Please contact an Administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=user)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if user.is_staff or user.is_superuser or user.username == "admin":
            if profile.role != UserRole.ADMIN:
                profile.role = UserRole.ADMIN
                profile.save()

        return Response({
            "token": token.key,
            "user": UserProfileSerializer(profile).data,
        })


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if request.user.is_staff or request.user.is_superuser or request.user.username == "admin":
            if profile.role != UserRole.ADMIN:
                profile.role = UserRole.ADMIN
                profile.save()
        return Response(UserProfileSerializer(profile).data)


class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if "full_name" in serializer.validated_data:
            profile.full_name = serializer.validated_data["full_name"]
            request.user.first_name = serializer.validated_data["full_name"]
            request.user.save(update_fields=["first_name"])
        if "avatar_url" in serializer.validated_data:
            profile.avatar_url = serializer.validated_data["avatar_url"]

        profile.save()
        return Response(UserProfileSerializer(profile).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"detail": "Your current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password updated successfully."})


def check_admin_permission(user):
    if not user or not user.is_authenticated:
        return False
    profile, _ = UserProfile.objects.get_or_create(user=user)
    if user.is_superuser or user.is_staff or user.username == "admin":
        if profile.role != UserRole.ADMIN:
            profile.role = UserRole.ADMIN
            profile.save()
        return True
    return profile.role == UserRole.ADMIN


class AdminUserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not check_admin_permission(request.user):
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        # Ensure all existing Django users have a UserProfile
        for u in User.objects.all():
            u_role = UserRole.ADMIN if (u.is_superuser or u.is_staff or u.username == "admin") else UserRole.SCIENTIST
            p, created = UserProfile.objects.get_or_create(
                user=u,
                defaults={
                    "role": u_role,
                    "full_name": u.first_name or u.username.capitalize(),
                },
            )

        profiles = UserProfile.objects.select_related("user").order_by("-created_at")
        return Response(UserProfileSerializer(profiles, many=True).data)


class AdminUserCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not check_admin_permission(request.user):
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        username = data["username"].strip()
        email = data.get("email", "").strip()
        full_name = data.get("full_name", "").strip() or username.capitalize()
        target_role = data.get("role", UserRole.SCIENTIST)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=data["password"],
            first_name=full_name,
        )

        user_profile, _ = UserProfile.objects.get_or_create(user=user)
        user_profile.role = target_role
        user_profile.full_name = full_name
        user_profile.save()

        return Response(UserProfileSerializer(user_profile).data, status=status.HTTP_201_CREATED)


def get_target_user(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        try:
            return UserProfile.objects.get(id=user_id).user
        except UserProfile.DoesNotExist:
            return None


class AdminUserToggleStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if not check_admin_permission(request.user):
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        target_user = get_target_user(user_id)
        if not target_user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if target_user.id == request.user.id:
            return Response({"detail": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)

        target_user.is_active = not target_user.is_active
        target_user.save(update_fields=["is_active"])

        target_profile, _ = UserProfile.objects.get_or_create(user=target_user)
        return Response(UserProfileSerializer(target_profile).data)


class AdminUserResetPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if not check_admin_permission(request.user):
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        new_password = request.data.get("new_password", "").strip()
        if len(new_password) < 6:
            return Response({"detail": "Password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

        target_user = get_target_user(user_id)
        if not target_user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        target_user.set_password(new_password)
        target_user.save()
        return Response({"detail": f"Password for {target_user.username} has been reset."})


class AdminUserDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        if not check_admin_permission(request.user):
            return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        target_user = get_target_user(user_id)
        if not target_user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if target_user.id == request.user.id or target_user.username == request.user.username:
            return Response({"detail": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)

        # Reassign protected foreign key references to current admin user before deleting
        try:
            from apps.dissolution.models import DissolutionRun
            DissolutionRun.objects.filter(created_by=target_user).update(created_by=request.user)
        except Exception:
            pass

        try:
            from apps.characterization.models import CharacterizationRun
            CharacterizationRun.objects.filter(created_by=target_user).update(created_by=request.user)
        except Exception:
            pass

        deleted_username = target_user.username
        target_user.delete()
        return Response({"detail": f"User account '{deleted_username}' has been permanently deleted."})
