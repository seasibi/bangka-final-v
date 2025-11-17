from django.conf import settings
from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework import status, viewsets, serializers
from rest_framework.decorators import api_view, permission_classes, action, authentication_classes
from .models import GpsData, MunicipalAgriculturist, ProvincialAgriculturist, User, Boat, Fisherfolk, ActivityLog, Organization, Address, Household, Contacts, BoatMeasurements, BoatGearAssignment, BoatGearTypeAssignment, BoatGearSubtypeAssignment, GearType, GearSubtype, DeviceToken, BirukbilugTracker, BoundaryViolationNotification, Municipality, Barangay, BarangayVerifier, Signatory
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import FisherfolkBoat, MunicipalityBoundary, LandBoundary
from .serializers import UserSerializer, BoatSerializer, FisherfolkSerializer, ActivityLogSerializer, ProvincialAgriculturistSerializer, MunicipalAgriculturistSerializer, AddressSerializer, HouseholdSerializer, OrganizationSerializer, ContactsSerializer, BoatMeasurementsSerializer, BoatGearAssignmentSerializer, BoatGearTypeAssignmentSerializer, BoatGearSubtypeAssignmentSerializer, BirukbilugTrackerSerializer, DeviceTokenSerializer, BoundaryViolationNotificationSerializer, MunicipalitySerializer, BarangaySerializer, BarangayVerifierSerializer, SignatorySerializer
from .serializers import FisherfolkBoatSerializer, MunicipalityBoundarySerializer, LandBoundarySerializer
from .gear_serializers import GearTypeSerializer, GearSubtypeSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from django.db.models import Exists, OuterRef, Q, Sum
from django.db import DatabaseError
import logging

logger = logging.getLogger(__name__)

# --- Import Boat Excel API ---
from rest_framework.views import APIView
from django.db import transaction
import re

from rest_framework.permissions import AllowAny, IsAuthenticated
from .permissions import IsAdmin, IsSelfOrAdmin, IsAdminOrAgriReadOnly
import pandas as pd
from rest_framework.parsers import MultiPartParser, FormParser

# TOKEN
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import authenticate, login, get_user_model
from django.contrib.auth.hashers import make_password
from django.db.models.functions import TruncMonth

#for generate report
from django.db.models import Q

from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

#For email 
import random
import string
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from django.core.validators import validate_email

# For password reset tokens
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
import json
from .boundary_service import check_and_notify_boundary_crossing
try:
    from .tasks import check_boundary_task
except Exception:
    check_boundary_task = None



# TOKEN
from django.views.decorators.csrf import csrf_exempt

# --- Email normalization helpers ---

def _canonical_email(email: str) -> str:
    try:
        if not email:
            return ""
        e = str(email).strip().lower()
        if "@" not in e:
            return e
        local, domain = e.split("@", 1)
        # Gmail family: ignore dots and plus aliases
        if domain in ("gmail.com", "googlemail.com"):
            local = local.split("+", 1)[0].replace(".", "")
            domain = "gmail.com"
        return f"{local}@{domain}"
    except Exception:
        return (email or "").strip().lower()

# --- Municipality normalization helpers (treat aliases as equivalent) ---
_ALIAS_MAP = {
    # Treat San Fernando aliases as the same
    'san fernando': ['San Fernando', 'City Of San Fernando'],
    'city of san fernando': ['San Fernando', 'City Of San Fernando'],
    # Common alias
    'sto. tomas': ['Santo Tomas', 'Sto. Tomas'],
    'santo tomas': ['Santo Tomas', 'Sto. Tomas'],
}

def _muni_aliases(name: str):
    try:
        if not name:
            return []
        key = str(name).strip().lower()
        return _ALIAS_MAP.get(key, [name])
    except Exception:
        return [name]

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def login_view(request):
    print("\n=== LOGIN REQUEST DEBUG ===")
    print(f"Request method: {request.method}")
    print(f"Request content type: {request.content_type}")
    print(f"Request data: {request.data}")
    print(f"CORS Origin: {request.META.get('HTTP_ORIGIN', 'No origin header')}")
    print(f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'No user agent')}")
    
    email = request.data.get('username')  # Frontend sends email as 'username' field
    password = request.data.get('password')

    # Ensure email is lowercase for consistency
    if email:
        email = email.lower()

    print(f"\nExtracted credentials: email={email}, password={'*' * len(password) if password else 'None'}")  # Debugging
    
    # Authenticate with email
    if email:
        try:
            user = User.objects.get(email=email.lower())
            if not user.check_password(password):
                user = None
            # Check if user is active
            elif not user.is_active:
                print(f"Inactive user attempted login: {user.email}")
                user = None
        except User.DoesNotExist:
            user = None
    else:
        user = None
    if user is not None:
        print(f"Authenticated user: {user.email}, role: {user.user_role}")  # Debugging
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        response = Response({
            "message": "Login successful",
            "access": access_token,
            "must_change_password": user.must_change_password,
            "user_role": user.user_role
        }, status=status.HTTP_200_OK)

        # Pull config from SIMPLE_JWT
        cookie_name = settings.SIMPLE_JWT.get("AUTH_COOKIE", "access_token")
        cookie_secure = settings.SIMPLE_JWT.get("AUTH_COOKIE_SECURE", False)
        cookie_httponly = settings.SIMPLE_JWT.get("AUTH_COOKIE_HTTP_ONLY", True)
        cookie_samesite = settings.SIMPLE_JWT.get("AUTH_COOKIE_SAMESITE", "Lax")
        access_token_lifetime = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
        refresh_token_lifetime = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())

        print(f"\nCookie settings:")
        print(f"  - cookie_name: {cookie_name}")
        print(f"  - cookie_secure: {cookie_secure}")
        print(f"  - cookie_httponly: {cookie_httponly}")
        print(f"  - cookie_samesite: {cookie_samesite}")
        print(f"  - max_age: {access_token_lifetime}")

        cookie_domain = settings.SIMPLE_JWT.get("AUTH_COOKIE_DOMAIN", None)
        
        # Set Access Token in Cookie
        response.set_cookie(
            key=cookie_name,
            value=access_token,
            httponly=cookie_httponly,
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=access_token_lifetime,
            path='/',
            domain=cookie_domain
        )

        # Optionally set Refresh Token in Cookie too
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=cookie_httponly,
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=refresh_token_lifetime,
            path='/',
            domain=cookie_domain
        )
        
        print(f"\nResponse cookies set: {response.cookies}")
        print(f"\nResponse headers: {response.headers}")
        
        # Force cookie headers to be set
        response['Set-Cookie'] = f'{cookie_name}={access_token}; HttpOnly; Max-Age={access_token_lifetime}; Path=/; SameSite={cookie_samesite}'
        
        # Log successful login
        try:
            from .models import ActivityLog
            ActivityLog.objects.create(
                user=user,
                action="Authentication",
                description=f"User logged in successfully"
            )
        except Exception as e:
            print(f"Failed to log login activity: {e}")
        
        return response
    
    else:
        print("Invalid credentials or user not active")  # Debugging
        return Response({"message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    # Log logout before clearing session
    try:
        from .models import ActivityLog
        ActivityLog.objects.create(
            user=request.user,
            action="Authentication",
            description=f"User logged out"
        )
    except Exception as e:
        print(f"Failed to log logout activity: {e}")
    
    response = Response({'message': 'Logged out successfully'}, status=200)
    
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    
    
    response.set_cookie('access_token', '', expires=0, httponly=True)
    response.set_cookie('refresh_token', '', expires=0, httponly=True)

    return response

@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token_view(request):
    print("\n=== REFRESH TOKEN REQUEST ===")
    print(f"Cookies: {request.COOKIES}")
    
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        print("No refresh token found in cookies")
        return Response({'error': 'No refresh token', 'detail': 'Please login again'}, status=401)

    try:
        cookie_secure = settings.SIMPLE_JWT.get("AUTH_COOKIE_SECURE", False)
        cookie_httponly = settings.SIMPLE_JWT.get("AUTH_COOKIE_HTTP_ONLY", True)
        cookie_samesite = settings.SIMPLE_JWT.get("AUTH_COOKIE_SAMESITE", "Lax")
        access_token_lifetime = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())

        refresh = RefreshToken(refresh_token)
        # Reject refresh for inactive users
        try:
            user_id = int(refresh['user_id'])
            user = User.objects.get(pk=user_id)
            if not user.is_active:
                return Response({'error': 'Account is inactive'}, status=401)
        except Exception:
            pass  # If anything goes wrong, fall back to default behavior

        access = str(refresh.access_token)

        res = Response({'access': access}, status=200)
        res.set_cookie(
            'access_token',
            access,
            httponly=cookie_httponly,
            samesite=cookie_samesite,
            secure=cookie_secure,
            max_age=access_token_lifetime, 
            path="/"
        )

        return res
    except Exception:
        return Response({'detail': 'Invalid refresh token'}, status=403)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_view(request):
    user = request.user
    user_data = {
        "id": user.id,
        "email": user.email,
        "user_role": user.user_role,
    }

    if user.user_role == 'admin' and user.admin_profile:
        user_data["first_name"] = user.admin_profile.first_name
        user_data["middle_name"] = getattr(user.admin_profile, "middle_name", None)
        user_data["last_name"] = user.admin_profile.last_name

    if user.user_role == 'provincial_agriculturist' and user.provincial_agriculturist:
        user_data["first_name"] = user.provincial_agriculturist.first_name
        user_data["middle_name"] = getattr(user.provincial_agriculturist, "middle_name", None)
        user_data["last_name"] = user.provincial_agriculturist.last_name
        
    # If user is a municipal agriculturist, include municipality
    if user.user_role == 'municipal_agriculturist' and user.municipal_agriculturist:
        user_data["municipality"] = user.municipal_agriculturist.municipality
        user_data["first_name"] = user.municipal_agriculturist.first_name
        user_data["middle_name"] = getattr(user.municipal_agriculturist, "middle_name", None)
        user_data["last_name"] = user.municipal_agriculturist.last_name
    return Response({
        "authenticated": True,
        "user": user_data
    })

# USERS
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_users(request):
    role = request.query_params.get('role')
    if role:
        users = User.objects.filter(user_role=role)
    else:
        users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    # Required fields (all fields combined)
    required_fields = ['email', 'user_role', 'first_name', 'last_name', 'sex', 'contact_number', 'position']
    
    # Add municipality to required fields if user_role is municipal_agriculturist
    if request.data.get('user_role') == 'municipal_agriculturist':
        required_fields.append('municipality')

    # Check for missing fields (middle_name is optional)
    missing_fields = [field for field in required_fields if not request.data.get(field)]

    if missing_fields:
        return Response(
            {
                'error': 'The following fields are required:',
                'missing_fields': missing_fields
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Generate temporary password
    temporary_password = generate_temporary_password()
    
    # Validate email
    email = request.data.get('email')
    try:
        validate_email(email)
    except ValidationError:
        return Response({"error": "Invalid email format"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Prepare data for serializer
    data = request.data.copy()
    data['password'] = temporary_password  # Don't hash here, serializer will handle it
    
    # Convert status string to boolean if provided as string
    if isinstance(data.get('is_active'), str):
        data['is_active'] = data['is_active'].lower() == 'true' or data['is_active'].lower() == 'active'
    else:
        data['is_active'] = True  # Default to active

    serializer = UserSerializer(data=data)
    if serializer.is_valid():
        user = serializer.save()
        # Set flag to require password change on first login
        user.must_change_password = True
        user.save()
        
        # If creating a new admin, deactivate all existing admins AFTER successful creation
        if data.get('user_role') == 'admin':
            try:
                # Find all currently active admins (both superusers and role='admin') EXCEPT the new one
                current_admins = User.objects.filter(is_active=True).filter(
                    models.Q(is_superuser=True) | models.Q(user_role='admin')
                ).exclude(id=user.id)
                
                deactivated_emails = []
                for admin in current_admins:
                    admin.is_active = False
                    admin.save()
                    deactivated_emails.append(admin.email)
                    
                    # Log deactivation
                    try:
                        ActivityLog.objects.create(
                            user=request.user,
                            action="User Management",
                            description=f"Deactivated admin {admin.email} after creating new admin {user.email}"
                        )
                    except Exception:
                        pass
                
                if deactivated_emails:
                    print(f"Deactivated existing admins: {deactivated_emails}")
            except Exception as e:
                print(f"Error deactivating existing admins: {e}")
                # Don't fail the user creation if deactivation fails
        
        # Log activity: user created
        try:
            from .models import ActivityLog
            who = getattr(request.user, 'email', 'system')
            role = data.get('user_role')
            ActivityLog.objects.create(user=request.user, action="User Management", description=f"Created user {email} as {role}")
        except Exception:
            pass
        
        # Send welcome email with temporary password
        try:
            subject = "Welcome to Bangka System"
            from_email = settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@bangka.com'
            recipient_list = [email]
            message = f"""
            Dear {data.get('first_name')},

            Welcome to the Bangka System. Your account has been successfully created.

            Your login credentials are:
            Email: {email}
            Temporary Password: {temporary_password}

            Please log in using these credentials and change your password immediately for security purposes.

            If you have any questions, please contact your administrator.

            Best regards,
            Bangka System Team
            """
            
            send_mail(subject, message, from_email, recipient_list, fail_silently=False)
            email_sent = True
        except Exception as e:
            print(f"Failed to send email: {str(e)}")
            email_sent = False
        
        return Response(
            {
                'message': 'User created successfully',
                'user': UserSerializer(user).data,
                'email_sent': email_sent,
                'note': 'Temporary password has been sent to the user\'s email' if email_sent else 'Failed to send email. Please contact the user directly.'
            },
            status=status.HTTP_201_CREATED
        )
    else:
        return Response(
            {
                'error': 'Invalid data.',
                'details': serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def deactivate_current_admin(request):
    """Deactivate the current active admin user when a new admin is being created."""
    try:
        # Find all currently active admins (both superusers and role='admin')
        current_admins = User.objects.filter(is_active=True).filter(
            models.Q(is_superuser=True) | models.Q(user_role='admin')
        )
        
        deactivated_count = 0
        deactivated_emails = []
        
        for admin in current_admins:
            admin.is_active = False
            admin.save()
            deactivated_count += 1
            deactivated_emails.append(admin.email)
            
            # Log activity
            try:
                ActivityLog.objects.create(
                    user=request.user if request.user.is_authenticated else None,
                    action="User Management",
                    description=f"Deactivated admin {admin.email} to make way for new admin"
                )
            except Exception:
                pass
        
        if deactivated_count > 0:
            return Response(
                {'message': f'Deactivated {deactivated_count} admin(s): {deactivated_emails}'},
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {'message': 'No active admin found to deactivate'},
                status=status.HTTP_200_OK
            )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Regular password change for already logged-in users."""
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    if not current_password or not new_password:
        return Response({'error': 'Current and new password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if not user.check_password(current_password):
        return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

    if len(str(new_password)) < 8:
        return Response({'error': 'Password must be at least 8 characters long'}, status=status.HTTP_400_BAD_REQUEST)

    if user.check_password(new_password):
        return Response({'error': 'New password cannot be the same as the current password'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    
    # Log password change
    try:
        from .models import ActivityLog
        ActivityLog.objects.create(
            user=user,
            action="Account Security",
            description="User changed password"
        )
    except Exception as e:
        print(f"Failed to log password change: {e}")

    return Response({'success': 'Password changed successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_new_password(request):
    """Set new password for first-time login (requires temporary password)."""
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    print(f"\n=== SET NEW PASSWORD DEBUG ===")
    print(f"User: {user.email}")
    print(f"Must change password: {user.must_change_password}")
    print(f"Current password provided: {'Yes' if current_password else 'No'} (length: {len(current_password) if current_password else 0})")
    print(f"New password provided: {'Yes' if new_password else 'No'} (length: {len(new_password) if new_password else 0})")
    print(f"Stored password hash starts with: {user.password[:20] if user.password else 'None'}...")
    print(f"Password is hashed: {user.password.startswith('pbkdf2_sha256$') if user.password else False}")

    # Only allow this for users who must change their password on first login
    if not user.must_change_password:
        print("❌ Error: User does not have must_change_password flag set")
        return Response({'error': 'This endpoint is only for required password changes'}, status=status.HTTP_403_FORBIDDEN)

    if not current_password or not new_password:
        print("❌ Error: Missing current or new password")
        return Response({'error': 'Current and new password are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if current password is correct
    print(f"About to verify password...")
    print(f"  - Entered password length: {len(current_password)}")
    print(f"  - Entered password first 2 chars: {current_password[:2] if len(current_password) >= 2 else current_password}")
    print(f"  - Entered password last 2 chars: {current_password[-2:] if len(current_password) >= 2 else current_password}")
    
    password_check = user.check_password(current_password)
    print(f"Password verification result: {password_check}")
    
    if not password_check:
        print("❌ Error: Current password is incorrect")
        print("   Please check the temporary password sent to your email")
        return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
    
    print("✅ Current password verified successfully")

    if len(str(new_password)) < 6:
        print("❌ Error: Password too short")
        return Response({'error': 'Password must be at least 6 characters long'}, status=status.HTTP_400_BAD_REQUEST)

    if user.check_password(new_password):
        print("❌ Error: New password same as current")
        return Response({'error': 'New password cannot be the same as the current password'}, status=status.HTTP_400_BAD_REQUEST)

    print("✅ All validations passed, updating password...")
    user.set_password(new_password)
    user.must_change_password = False
    user.save()
    print("✅ Password updated successfully")

    # Log password change for first-login flow
    try:
        from .models import ActivityLog
        ActivityLog.objects.create(
            user=user,
            action="Account Security",
            description="User set new password (first-time login)"
        )
    except Exception as e:
        print(f"Failed to log password change: {e}")
    
    return Response({'success': 'Password updated successfully'}, status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def update_user(request, pk):
    try:
        user = User.objects.get(id=pk)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = UserSerializer(user)
        return Response(serializer.data)
    elif request.method == 'PUT':
        # Don't hash password here - let serializer handle it
        # if 'password' in request.data and request.data['password']:
        #     The serializer will handle password hashing

        # Prepare data for serializer
        data = request.data.copy()

        # Flatten nested agriculturist object if provided
        if 'municipal_agriculturist' in data:
            agri = data.pop('municipal_agriculturist')
            if isinstance(agri, dict):
                data.update({
                    'first_name': agri.get('first_name') or agri.get('first_name'),
                    'middle_name': agri.get('middle_name') or agri.get('middle_name', ''),
                    'last_name': agri.get('last_name') or agri.get('last_name'),
                    'sex': agri.get('sex') or agri.get('sex'),
                    'contact_number': agri.get('contact_number') or agri.get('contact_number'),
                    'position': agri.get('position') or agri.get('position'),
                    'municipality': agri.get('municipality') or agri.get('municipality'),
                })
        if 'provincial_agriculturist' in data:
            agri = data.pop('provincial_agriculturist')
            if isinstance(agri, dict):
                data.update({
                    'first_name': agri.get('first_name') or agri.get('first_name'),
                    'middle_name': agri.get('middle_name') or agri.get('middle_name', ''),
                    'last_name': agri.get('last_name') or agri.get('last_name'),
                    'sex': agri.get('sex') or agri.get('gender'),
                    'contact_number': agri.get('contact_number') or agri.get('phone_number'),
                    'position': agri.get('position') or agri.get('position'),
                })

        # Convert status string to boolean if provided as string
        if isinstance(data.get('is_active'), str):
            data['is_active'] = data['is_active'].lower() == 'true' or data['is_active'].lower() == 'active'

        serializer = UserSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            prev_active = bool(user.is_active)
            user = serializer.save()
            # Log activity: user updated and status changes
            try:
                from .models import ActivityLog
                who = getattr(request.user, 'email', 'system')
                if prev_active != bool(user.is_active):
                    action = "Activated" if user.is_active else "Deactivated"
                    ActivityLog.objects.create(user=request.user, action="User Management", description=f"{action} user {user.email}")
                else:
                    ActivityLog.objects.create(user=request.user, action="User Management", description=f"Updated user {user.email}")
            except Exception:
                pass
            return Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid data.', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def check_email(request):
    """Check if an email is already in use."""
    if request.method == 'POST':
        email = request.data.get('email')
    else:
        email = request.GET.get('email', '')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    target = _canonical_email(email)
    # Compare using canonical form across all users (active or not)
    exists = any(_canonical_email(u.email) == target for u in User.objects.all())
    return Response({'exists': exists, 'available': not exists}, status=status.HTTP_200_OK)

# BOATS Registry
class BoatViewSet(viewsets.ModelViewSet):
    queryset = Boat.objects.all()
    serializer_class = BoatSerializer
    permission_classes = [AllowAny]  # Allow public access for tracking page

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            status_param = request.query_params.get('status')
            if status_param:
                if status_param.lower() == 'active':
                    queryset = queryset.filter(is_active=True)
                elif status_param.lower() == 'inactive':
                    queryset = queryset.filter(is_active=False)
            if request.query_params.get('count_only') == 'true':
                return Response({'count': queryset.count()})
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in list action: {str(e)}")
            return Response(
                {"error": "An error occurred while fetching fisherfolk data."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        print("Received data:", request.data)
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("Validation errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        print("DATA RECEIVED:", request.data)
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Create a mutable copy of the request data
        mutable_data = request.data.copy()
        
        # Set the mfbr_number to the instance's primary key (mfbr_number, not boat_id)
        mutable_data['mfbr_number'] = instance.mfbr_number
        
        # Remove boat_image field if it's not a proper file upload or is invalid
        if 'boat_image' in mutable_data:
            boat_image_value = mutable_data['boat_image']
            # If boat_image is empty, None, an array, or not a file, remove it
            if (not boat_image_value or 
                boat_image_value == '' or 
                isinstance(boat_image_value, list) or 
                (hasattr(boat_image_value, '__iter__') and not hasattr(boat_image_value, 'read'))):
                del mutable_data['boat_image']
                print("Removed invalid boat_image field from request data")
        
        serializer = self.get_serializer(instance, data=mutable_data, partial=partial)
        if serializer.is_valid():
            self.perform_update(serializer)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        queryset = Boat.objects.all()
        municipality = self.request.query_params.get('municipality', None)
        if municipality:
            aliases = _muni_aliases(municipality)
            # Case-insensitive match on either fisherfolk's address municipality or boat's cached registered_municipality
            cond = models.Q()
            for a in aliases:
                cond |= models.Q(fisherfolk_registration_number__address__municipality__iexact=a)
                cond |= models.Q(registered_municipality__iexact=a)
            queryset = queryset.filter(cond)
        return queryset

    @action(detail=True, methods=['put'], url_path='archive')
    def archive(self, request, pk=None):
        try:
            boat = self.get_object()
            boat.status = 'archived'  # or whatever your archive logic is
            boat.save()
            return Response({'status': 'archived'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=True, methods=['patch'])
    def location(self, request, pk=None):
        boat = self.get_object()
        serializer = BoatLocationUpdateSerializer(boat, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def location_history(self, request, pk=None):
        boat = self.get_object()
        # Get the FisherfolkBoat instance for this boat
        try:
            fisherfolk_boat = FisherfolkBoat.objects.get(BoatID=boat)
            # Get location history through BoatBirukbilugTracker
            history = BoatBirukbilugTracker.objects.filter(BoatRegistryNo=fisherfolk_boat).order_by('-Timestamp')
            serializer = BoatBirukbilugTrackerSerializer(history, many=True)
            return Response(serializer.data)
        except FisherfolkBoat.DoesNotExist:
            return Response({"error": "No registered boat found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def by_municipality(self, request):
        boats = Boat.objects.values('municipality').annotate(
            total=models.Count('id'),
            active=models.Count('id', filter=Q(status='active')),
            inactive=models.Count('id', filter=Q(status='inactive'))
        )
        return Response(boats)

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        boats = Boat.objects.values('boat_type').annotate(
            total=models.Count('id'),
            active=models.Count('id', filter=Q(status='active')),
            inactive=models.Count('id', filter=Q(status='inactive'))
        )
        return Response(boats)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        # Get total counts
        total_boats = Boat.objects.count()
        active_boats = Boat.objects.filter(status='active').count()
        inactive_boats = Boat.objects.filter(status='inactive').count()

        # Get monthly registration counts for the past 12 months
        monthly_registrations = Boat.objects.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=models.Count('id')
        ).order_by('-month')[:12]

        return Response({
            'total_boats': total_boats,
            'active_boats': active_boats,
            'inactive_boats': inactive_boats,
            'monthly_registrations': monthly_registrations
        })

class FisherfolkViewSet(viewsets.ModelViewSet):
    queryset = Fisherfolk.objects.all()
    serializer_class = FisherfolkSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'first_name': ['istartswith'],
        'last_name': ['istartswith'],
        'registration_number': ['istartswith'],
    }

    def get_queryset(self):
        qs = Fisherfolk.objects.all()
        muni = self.request.query_params.get('municipality') or self.request.query_params.get('muni')
        if muni:
            aliases = _muni_aliases(muni)
            cond = models.Q()
            for a in aliases:
                cond |= models.Q(address__municipality__iexact=a)
            qs = qs.filter(cond)
        return qs
        
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            status_param = request.query_params.get('status')
            if status_param:
                if status_param.lower() == 'active':
                    queryset = queryset.filter(is_active=True)
                elif status_param.lower() == 'inactive':
                    queryset = queryset.filter(is_active=False)
            if request.query_params.get('count_only') == 'true':
                return Response({'count': queryset.count()})
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in list action: {str(e)}")
            return Response(
                {"error": "An error occurred while fetching fisherfolk data."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, validated_data):
        request = self.context.get('request', None)
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        else:
            raise serializers.ValidationError("A valid user is required to create a Fisherfolk record.")
        
        instance = super().create(validated_data)
        return instance
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        try:
            # Rely on serializer.to_internal_value to normalize other_source_livelihood
            # Split out file upload to avoid issues with copying/pickling multipart data
            try:
                payload = request.data.copy()
            except Exception:
                payload = dict(request.data)
            if hasattr(payload, 'pop'):
                try:
                    payload.pop('fisherfolk_img')
                except Exception:
                    pass
            # Enforce different contact numbers (fisherfolk vs contact person)
            try:
                def _digits(s):
                    return ''.join([c for c in str(s or '') if c.isdigit()])
                cn1 = _digits(request.data.get('contact_number'))
                cn2 = _digits(request.data.get('contact_contactno'))
                if cn1 and cn2 and cn1 == cn2:
                    return Response({'contact_contactno': ['Contact person number must be different from fisherfolk contact number.']}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass

            serializer = self.get_serializer(data=payload)
            try:
                serializer.is_valid(raise_exception=True)
            except serializers.ValidationError as ve:
                return Response(ve.detail, status=status.HTTP_400_BAD_REQUEST)

            fisherfolk = serializer.save()
            # Attach image after main save
            try:
                file_obj = None
                # Prefer request.FILES for robust access to uploaded file
                if hasattr(request, 'FILES'):
                    file_obj = request.FILES.get('fisherfolk_img')
                if not file_obj:
                    # Some clients send under different key
                    file_obj = request.data.get('fisherfolk_img')
                if file_obj:
                    fisherfolk.fisherfolk_img = file_obj
                    fisherfolk.save(update_fields=['fisherfolk_img'])
            except Exception:
                # Do not fail create due to image attach problems
                pass
            def _to_int(val):
                try:
                    s = str(val).strip()
                    if s == "":
                        return None
                    return int(s)
                except Exception:
                    return None
            total = _to_int(request.data.get("total_no_household_memb"))
            no_male = _to_int(request.data.get("no_male"))
            no_female = _to_int(request.data.get("no_female"))
            no_children = _to_int(request.data.get("no_children"))
            no_in_school = _to_int(request.data.get("no_in_school"))
            no_out_school = _to_int(request.data.get("no_out_school"))
            no_employed = _to_int(request.data.get("no_employed"))
            no_unemployed = _to_int(request.data.get("no_unemployed"))

            hv_errors = []
            # total must equal male + female
            if no_male is not None and no_female is not None and total is not None:
                if (no_male + no_female) != total:
                    hv_errors.append("Male + Female must equal Total household members.")
            # children rules: in_school + out_school = children, and children < total
            if no_in_school is not None and no_out_school is not None:
                children_calc = no_in_school + no_out_school
                if total is not None and children_calc >= total:
                    hv_errors.append("In-school + Out-of-school must be less than Total household members.")
                if no_children is not None and no_children != children_calc:
                    hv_errors.append("Children must equal In-school + Out-of-school.")
            # employment split: employed + unemployed = total - children
            if total is not None and no_children is not None:
                adults = max(total - no_children, 0)
                if no_employed is not None and no_unemployed is not None:
                    if (no_employed + no_unemployed) != adults:
                        hv_errors.append("Employed + Unemployed must equal Total minus Children.")
            if hv_errors:
                return Response({"household": hv_errors}, status=status.HTTP_400_BAD_REQUEST)

            fisherfolk = serializer.save()

            # Address (coerce types safely)
            address_fields = [
                "street", "barangay", "municipality", "province", "region",
                "residency_years", "barangay_verifier", "position", "verified_date"
            ]
            address_data = {field: request.data.get(field) for field in address_fields}
            address_data["fisherfolk"] = fisherfolk
            # Coerce residency_years to int when provided
            try:
                if address_data.get("residency_years") not in (None, ""):
                    address_data["residency_years"] = int(str(address_data["residency_years"]).strip())
            except Exception:
                # Drop invalid numeric to avoid 500s
                address_data["residency_years"] = None
            # Parse verified_date when provided (YYYY-MM-DD)
            try:
                from datetime import date
                if address_data.get("verified_date"):
                    s = str(address_data["verified_date"]).strip()
                    if s:
                        address_data["verified_date"] = date.fromisoformat(s)
            except Exception:
                address_data["verified_date"] = None
            if any(v not in (None, "") for v in address_data.values() if v is not fisherfolk):
                try:
                    Address.objects.create(**address_data)
                except Exception:
                    # Do not fail whole request due to related model; proceed
                    pass

            # Household (fill optional numeric fields and coerce all to int)
            household_fields = [
                "total_no_household_memb", "no_male", "no_female", "no_children",
                "no_in_school", "no_out_school", "no_employed", "no_unemployed"
            ]
            household_data = {field: request.data.get(field) for field in household_fields}
            household_data["fisherfolk"] = fisherfolk
            def _to_int(val, default=None):
                try:
                    s = str(val).strip()
                    if s == "":
                        return default
                    return int(s)
                except Exception:
                    return default
            # Required numerics
            for f in ["total_no_household_memb", "no_male", "no_female", "no_children"]:
                household_data[f] = _to_int(household_data.get(f))
            # Optional numerics default to 0
            for f in ["no_in_school", "no_out_school", "no_employed", "no_unemployed"]:
                household_data[f] = _to_int(household_data.get(f), 0)
            if any(v not in (None, "") for v in household_data.values() if v is not fisherfolk):
                try:
                    Household.objects.create(**household_data)
                except Exception:
                    pass

                # Contacts
                contact_fields = [
                    "contact_fname", "contact_lname", "contact_mname", "contact_relationship",
                    "contact_contactno", "contact_municipality", "contact_barangay"
                ]
                contact_data = {field: request.data.get(field) for field in contact_fields}
                contact_data["fisherfolk"] = fisherfolk
                if any(contact_data.values()):
                    Contacts.objects.create(**contact_data)

                # Fallback: if serializer.create() did not create organizations from flattened keys,
                # create one here when org fields are present and no org exists yet
                try:
                    if not fisherfolk.organizations.exists():
                        import re
                        org_data_list = []
                        for key, value in request.data.items():
                            m = re.match(r'organizations\[(\d+)\]\[(\w+)\]', key)
                            if m:
                                idx, fld = m.groups()
                                idx = int(idx)
                                while len(org_data_list) <= idx:
                                    org_data_list.append({})
                                org_data_list[idx][fld] = value
                        for org in org_data_list:
                            name = (org.get('org_name') or '').strip()
                            if name.lower() in ('other', 'others', ''):
                                custom = (
                                    org.get('organization_name')
                                    or org.get('org_custom_name')
                                    or org.get('org_other')
                                    or org.get('custom_org_name')
                                )
                                if custom:
                                    name = str(custom).strip()
                            if any(org.get(f) for f in ['org_name', 'member_since', 'org_position']) or name:
                                if not name:
                                    continue
                                Organization.objects.create(
                                    fisherfolk=fisherfolk,
                                    org_name=name,
                                    member_since=org.get('member_since') or None,
                                    org_position=org.get('org_position') or None,
                                )
                except Exception:
                    pass

                # Re-serialize after related creations
                final_data = self.get_serializer(fisherfolk).data
                headers = self.get_success_headers(final_data)
                return Response(final_data, status=status.HTTP_201_CREATED, headers=headers)

            # Re-serialize to include any post-save updates (e.g., image URL)
            serializer = self.get_serializer(fisherfolk)
            # Log activity: fisherfolk created
            try:
                from .models import ActivityLog
                who = getattr(request.user, 'email', 'system')
                ActivityLog.objects.create(user=request.user, action="Fisherfolk Management", description=f"Created fisherfolk: {fisherfolk.first_name} {fisherfolk.last_name} ({fisherfolk.registration_number})")
            except Exception:
                pass
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            import traceback as _tb
            tb = _tb.format_exc()
            return Response({
                "error": str(e),
                "type": e.__class__.__name__,
                "traceback": tb[-4000:],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        prev_status = bool(getattr(instance, 'is_active', False))  # capture BEFORE save
        # Pass raw request.data; serializer handles array normalization
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            # Enforce different contact numbers on update if both provided
            try:
                def _digits(s):
                    return ''.join([c for c in str(s or '') if c.isdigit()])
                cn1 = _digits(request.data.get('contact_number'))
                cn2 = _digits(request.data.get('contact_contactno'))
                if cn1 and cn2 and cn1 == cn2:
                    return Response({'contact_contactno': ['Contact person number must be different from fisherfolk contact number.']}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                pass

            # If image file is present, attach it after validation on the instance
            try:
                file_obj = None
                if hasattr(request, 'FILES'):
                    file_obj = request.FILES.get('fisherfolk_img')
                if file_obj:
                    # We'll set it on the instance after saving core fields below
                    pass
            except Exception:
                file_obj = None

            # Validate household constraints if relevant fields provided
            def _to_int(val):
                try:
                    s = str(val).strip()
                    if s == "":
                        return None
                    return int(s)
                except Exception:
                    return None
            total = _to_int(request.data.get("total_no_household_memb"))
            no_male = _to_int(request.data.get("no_male"))
            no_female = _to_int(request.data.get("no_female"))
            no_children = _to_int(request.data.get("no_children"))
            no_in_school = _to_int(request.data.get("no_in_school"))
            no_out_school = _to_int(request.data.get("no_out_school"))
            no_employed = _to_int(request.data.get("no_employed"))
            no_unemployed = _to_int(request.data.get("no_unemployed"))

            hv_errors = []
            # Only enforce when all operands needed for a rule are present in the update payload
            if no_male is not None and no_female is not None and total is not None:
                if (no_male + no_female) != total:
                    hv_errors.append("Male + Female must equal Total household members.")
            # children rules: in_school + out_school = children, and children < total
            if no_in_school is not None and no_out_school is not None:
                children_calc = no_in_school + no_out_school
                if total is not None and children_calc >= total:
                    hv_errors.append("In-school + Out-of-school must be less than Total household members.")
                if no_children is not None and no_children != children_calc:
                    hv_errors.append("Children must equal In-school + Out-of-school.")
            # employment split: employed + unemployed = total - children
            if total is not None and no_children is not None:
                adults = max(total - no_children, 0)
                if no_employed is not None and no_unemployed is not None:
                    if (no_employed + no_unemployed) != adults:
                        hv_errors.append("Employed + Unemployed must equal Total minus Children.")
            if hv_errors:
                return Response({"household": hv_errors}, status=status.HTTP_400_BAD_REQUEST)

            # Force-read OSL intent directly from raw request to avoid DRF dropping empty arrays
            explicit_osl = None
            try:
                if hasattr(request.data, "getlist"):
                    lst = request.data.getlist("other_source_livelihood[]") or request.data.getlist("other_source_livelihood")
                    if lst == []:
                        explicit_osl = []
                raw = request.data.get("other_source_livelihood")
                if explicit_osl is None and isinstance(raw, str) and raw.strip() in ("[]", ""):
                    explicit_osl = []
            except Exception:
                pass

            if explicit_osl is not None:
                fisherfolk = serializer.save(other_source_livelihood=explicit_osl)
            else:
                fisherfolk = serializer.save()

            # If a new image was uploaded, attach it now
            try:
                if 'fisherfolk_img' in getattr(request, 'FILES', {}):
                    fisherfolk.fisherfolk_img = request.FILES['fisherfolk_img']
                    fisherfolk.save(update_fields=['fisherfolk_img'])
            except Exception:
                pass
            
            # Update Address
            address_fields = [
                "street", "barangay", "municipality", "province", "region",
                "residency_years", "barangay_verifier", "position", "verified_date"
            ]
            address_data = {field: request.data.get(field) for field in address_fields if field in request.data}
            if address_data:
                Address.objects.update_or_create(
                    fisherfolk=fisherfolk,
                    defaults=address_data
                )
            
            # Update Household
            household_fields = [
                "total_no_household_memb", "no_male", "no_female", "no_children",
                "no_in_school", "no_out_school", "no_employed", "no_unemployed"
            ]
            household_data = {field: request.data.get(field) for field in household_fields if field in request.data}
            if household_data:
                Household.objects.update_or_create(
                    fisherfolk=fisherfolk,
                    defaults=household_data
                )
            
            # Update Contacts
            contact_fields = [
                "contact_fname", "contact_lname", "contact_mname", "contact_relationship",
                "contact_contactno", "contact_municipality", "contact_barangay", "contact_street"
            ]
            contact_data = {field: request.data.get(field) for field in contact_fields if field in request.data}
            if contact_data:
                Contacts.objects.update_or_create(
                    fisherfolk=fisherfolk,
                    defaults=contact_data
                )
            
            # Update Organizations (support flattened organizations[0][field] form-data)
            try:
                import re
                from datetime import datetime
                org_data_list = []
                for key, value in request.data.items():
                    m = re.match(r'organizations\[(\d+)\]\[(\w+)\]', key)
                    if m:
                        idx, fld = m.groups()
                        idx = int(idx)
                        while len(org_data_list) <= idx:
                            org_data_list.append({})
                        org_data_list[idx][fld] = value
                for org in org_data_list:
                    # Resolve custom name if 'Others' chosen
                    name = org.get("org_name") or ""
                    if name.strip().lower() in ("other", "others", ""):
                        custom = (
                            org.get("organization_name")
                            or org.get("org_custom_name")
                            or org.get("org_other")
                            or org.get("custom_org_name")
                            or org.get("orgname")
                            or org.get("orgname_other")
                        )
                        if custom:
                            org["org_name"] = str(custom).strip()
                    ms = org.get("member_since")
                    if isinstance(ms, str) and "/" in ms and "-" not in ms:
                        try:
                            org["member_since"] = datetime.strptime(ms, "%d/%m/%Y").date()
                        except Exception:
                            pass
                    # Only update/create if something provided
                    if any(org.get(f) for f in ["org_name", "member_since", "org_position"]):
                        Organization.objects.update_or_create(
                            fisherfolk=fisherfolk,
                            defaults={k: v for k, v in org.items() if k in ["org_name", "member_since", "org_position"]}
                        )
            except Exception:
                pass
            
            # Re-serialize to include updated related objects (address, household, contacts, organizations)
            # Log activity: fisherfolk updated (+ status change if any)
            try:
                from .models import ActivityLog
                who = getattr(request.user, 'email', 'system')
                # Detect status change using pre-save snapshot
                cur_status = bool(getattr(fisherfolk, 'is_active', False))
                if prev_status != cur_status:
                    action = "Activated" if cur_status else "Deactivated"
                    ActivityLog.objects.create(user=request.user, action="Fisherfolk Management", description=f"{action} fisherfolk: {fisherfolk.first_name} {fisherfolk.last_name} ({fisherfolk.registration_number})")
                    # Cascade status to all owned boats after the fisherfolk save commits
                    try:
                        from django.db import transaction as _tx
                        def _cascade():
                            try:
                                Boat.objects.filter(fisherfolk_registration_number=fisherfolk).update(is_active=cur_status)
                            except Exception:
                                pass
                        _tx.on_commit(_cascade)
                    except Exception:
                        pass
                else:
                    ActivityLog.objects.create(user=request.user, action="Fisherfolk Management", description=f"Updated fisherfolk: {fisherfolk.first_name} {fisherfolk.last_name} ({fisherfolk.registration_number})")
            except Exception:
                pass
            refreshed = self.get_serializer(fisherfolk)
            return Response(refreshed.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('query', '')
        if not query:
            return Response([])

        fisherfolk = Fisherfolk.objects.filter(
            models.Q(registration_number__icontains=query) |
            models.Q(first_name__icontains=query) |
            models.Q(last_name__icontains=query) |
            models.Q(middle_name__icontains=query)
        ).filter(is_active=True)[:10]  # Limit to 10 results for performance

        serializer = self.get_serializer(fisherfolk, many=True)
        return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def check_registration_number(request):
    reg_no = request.GET.get('registration_number', '')
    available = not Fisherfolk.objects.filter(registration_number=reg_no).exists()
    return JsonResponse({'available': available})

class FisherfolkBoatViewSet(viewsets.ModelViewSet):
    queryset = FisherfolkBoat.objects.all()
    serializer_class = FisherfolkBoatSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in FisherfolkBoat list: {str(e)}")
            return Response({"error": "An error occurred while fetching fisherfolk boats."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                self.perform_create(serializer)
                # Log activity: boat created
                try:
                    from .models import ActivityLog
                    who = getattr(request.user, 'email', 'system')
                    name = serializer.validated_data.get('boat_name') or 'Unnamed'
                    ActivityLog.objects.create(user=request.user, action="Boat Registry", description=f"Created boat {name}")
                except Exception:
                    pass
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            print("Validation errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error in FisherfolkBoat create: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            self.perform_update(serializer)
            # Log activity: boat updated
            try:
                from .models import ActivityLog
                who = getattr(request.user, 'email', 'system')
                name = serializer.validated_data.get('boat_name') or getattr(instance, 'boat_name', 'Unnamed')
                ActivityLog.objects.create(user=request.user, action="Boat Registry", description=f"Updated boat {name}")
            except Exception:
                pass
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

# Utility for cleanup of provisional trackers
class ProvisionalTrackerCleanup:
    @staticmethod
    def cleanup_stale(hours=24):
        """
        Remove provisional trackers that were created more than 'hours' ago and never activated.
        This should be called periodically from a scheduled task.
        """
        from .models import BirukbilugTracker
        from django.utils import timezone
        import datetime
        
        cutoff_time = timezone.now() - datetime.timedelta(hours=hours)
        
        # Get trackers that are still provisional and were created before the cutoff
        stale_trackers = BirukbilugTracker.objects.filter(
            provisional=True,
            date_added__lt=cutoff_time
        )
        
        if stale_trackers.exists():
            tracker_ids = list(stale_trackers.values_list('BirukBilugID', flat=True))
            count = stale_trackers.count()
            
            # Delete the trackers
            stale_trackers.delete()
            
            # Log the cleanup
            from .models import ActivityLog
            ActivityLog.objects.create(
                action="System", 
                description=f"Automatically removed {count} stale provisional trackers: {', '.join(tracker_ids)}"
            )
            
            return count, tracker_ids
        return 0, []


class BirukbilugTrackerViewSet(viewsets.ModelViewSet):
    queryset = BirukbilugTracker.objects.all()
    serializer_class = BirukbilugTrackerSerializer
    permission_classes = [AllowAny]  # Temporarily allow any for testing

    # Coastal municipalities allowed for tracker registration
    ALLOWED_MUNICIPALITIES = {
        "Agoo",
        "Aringay",
        "Bacnotan",
        "Balaoan",
        "Bangar",
        "Bauang",
        "Caba",
        "Luna",
        "Rosario",
        "City Of San Fernando",
        "San Juan",
        "Santo Tomas",
        "Sudipen",
    }

    MUNI_PREFIX = {
        "Agoo": "AGO",
        "Aringay": "ARI",
        "Bacnotan": "BAC",
        "Bagulin": "BAG",
        "Balaoan": "BAL",
        "Bangar": "BNG",
        "Bauang": "BAU",
        "Burgos": "BUR",
        "Caba": "CAB",
        "Luna": "LUN",
        "Naguilian": "NAG",
        "Pugo": "PUG",
        "Rosario": "ROS",
        "San Fernando": "SFE",
        "City Of San Fernando": "CSF",
        "San Gabriel": "SGB",
        "San Juan": "SJU",
        "Santol": "STL",
        "Santo Tomas": "STO",
        "Sudipen": "SUD",
        "Tubao": "TUB",
    }

    def _prefix_for(self, municipality: str) -> str:
        if not municipality:
            return "XXX"
        return self.MUNI_PREFIX.get(municipality, municipality[:3].upper())

    def _next_sequence_for_prefix(self, prefix: str) -> int:
        # Find max numeric suffix for existing IDs with this prefix
        max_n = 0
        try:
            qs = BirukbilugTracker.objects.filter(BirukBilugID__startswith=f"{prefix}-").values_list("BirukBilugID", flat=True)
            pat = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
            for bid in qs:
                m = pat.match(str(bid))
                if m:
                    try:
                        n = int(m.group(1))
                        if n > max_n:
                            max_n = n
                    except Exception:
                        pass
        except Exception:
            pass
        return max_n + 1

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        municipality = data.get("municipality") or data.get("Municipality")
        if not municipality:
            return Response({"municipality": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce coastal municipalities only
        if municipality not in self.ALLOWED_MUNICIPALITIES:
            return Response(
                {"municipality": ["Only coastal municipalities are allowed for tracker registration."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Always auto-generate the ID
        prefix = self._prefix_for(municipality)
        seq = self._next_sequence_for_prefix(prefix)
        biruk_id = f"{prefix}-{seq:04d}"
        data["BirukBilugID"] = biruk_id
        
        # Set provisional=True by default (will be changed to False after successful ESP32 provisioning)
        data["provisional"] = True

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Log activity: tracker created
        try:
            from .models import ActivityLog
            who = getattr(request.user, 'email', 'system')
            ActivityLog.objects.create(user=request.user, action="Tracker Management", description=f"Registered tracker {biruk_id} for municipality {municipality}")
        except Exception:
            pass
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in BirukbilugTracker list: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"An error occurred while fetching trackers: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DeviceTokenViewSet(viewsets.ModelViewSet):
    queryset = DeviceToken.objects.all().order_by('-created_at')
    serializer_class = DeviceTokenSerializer
    permission_classes = [IsAuthenticated]

    def _log(self, request, message: str):
        try:
            ActivityLog.objects.create(user=request.user, action="System", description=message)
        except Exception:
            pass

    def get_queryset(self):
        qs = super().get_queryset()
        name = self.request.query_params.get('name')
        boat_id = self.request.query_params.get('boat_id')
        tracker_id = self.request.query_params.get('tracker') or self.request.query_params.get('tracker_id')
        if name:
            qs = qs.filter(name__iexact=name)
        if tracker_id:
            qs = qs.filter(tracker__BirukBilugID=tracker_id)
        if boat_id:
            try:
                qs = qs.filter(boat_id=int(boat_id))
            except Exception:
                pass
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        headers = self.get_success_headers(serializer.data)
        # Log audit
        who = getattr(request.user, 'email', 'system')
        msg = f"DeviceToken created for tracker={instance.tracker.BirukBilugID if instance.tracker else instance.name} by {who}"
        self._log(request, msg)
        # Return token in response for provisioning
        data = DeviceTokenSerializer(instance).data
        data['token'] = instance.token
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'])
    def rotate(self, request, pk=None):
        import secrets
        instance = self.get_object()
        old = instance.token
        # Generate a new unique token
        for _ in range(5):
            new_token = secrets.token_hex(32)
            if not DeviceToken.objects.filter(token=new_token).exists():
                instance.token = new_token
                instance.save(update_fields=['token'])
                break
        self._log(request, f"DeviceToken rotated for tracker={instance.tracker.BirukBilugID if instance.tracker else instance.name}")
        data = {'id': instance.id, 'token': instance.token}
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        self._log(request, f"DeviceToken revoked for tracker={instance.tracker.BirukBilugID if instance.tracker else instance.name}")
        return Response({'id': instance.id, 'is_active': instance.is_active}, status=status.HTTP_200_OK)
        
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        Activate a device token after successful provisioning.
        Required payload fields:
        - device_id: unique device identifier generated during provisioning
        - tracker_id: BirukBilugID of the tracker to activate
        - status: should be 'active'
        """
        instance = self.get_object()
        
        # Validate the request
        device_id = request.data.get('device_id')
        tracker_id = request.data.get('tracker_id')
        req_status = request.data.get('status')
        
        if not device_id:
            return Response({"error": "device_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if req_status != 'active':
            return Response({"error": "status must be 'active'"}, status=status.HTTP_400_BAD_REQUEST)
            
        if not tracker_id:
            return Response({"error": "tracker_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find the tracker
        from .models import BirukbilugTracker
        tracker = BirukbilugTracker.objects.filter(BirukBilugID=tracker_id).first()
            
        if not tracker:
            return Response({"error": f"Tracker {tracker_id} not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # This is a critical check - only allow activation of provisional trackers
        if not hasattr(tracker, 'provisional') or not tracker.provisional:
            return Response({"error": "Cannot activate a tracker that is not in provisional state"}, 
                           status=status.HTTP_400_BAD_REQUEST)
            
        # Update the provisional flag on the tracker to confirm it
        tracker.provisional = False
        tracker.save(update_fields=['provisional'])
        
        # Update the device token
        instance.is_active = True
        
        # Store the device_id for future identification
        if hasattr(instance, 'device_id'):
            instance.device_id = device_id
        
        # Link to the tracker if not already linked
        if not instance.tracker:
            instance.tracker = tracker
        
        # Save all changes
        update_fields = ['is_active']
        if hasattr(instance, 'device_id'):
            update_fields.append('device_id')
        if not instance.tracker:
            update_fields.append('tracker')
            
        instance.save(update_fields=update_fields)
        
        # Log the activation
        self._log(
            request,
            f"DeviceToken activated for tracker={tracker_id} with device_id={device_id}"
        )
        
        # Return success response
        return Response({
            'id': instance.id,
            'is_active': instance.is_active,
            'device_id': device_id,
            'tracker_id': tracker_id,
            'activation_time': instance.last_seen_at,
            'provisional': False
        }, status=status.HTTP_200_OK)


class ProvincialAgriculturistViewSet(viewsets.ModelViewSet):
    queryset = ProvincialAgriculturist.objects.all()
    serializer_class = ProvincialAgriculturistSerializer

class MunicipalAgriculturistViewSet(viewsets.ModelViewSet):
    queryset = MunicipalAgriculturist.objects.all()
    serializer_class = MunicipalAgriculturistSerializer

class LandBoundaryViewSet(viewsets.ModelViewSet):
    queryset = LandBoundary.objects.all()
    serializer_class = LandBoundarySerializer
    
class ActivityLogViewSet(viewsets.ModelViewSet):
    queryset = ActivityLog.objects.all().order_by('-timestamp')
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user_role = self.request.user.user_role if hasattr(self.request.user, 'user_role') else 'unknown'
        serializer.save(user=self.request.user, user_role=user_role)

    def get_queryset(self):
        qs = super().get_queryset()
        count = self.request.query_params.get('count')
        if count:
            try:
                count = int(count)
                return qs[:count]
            except ValueError:
                pass
        return qs


# Municipality color mapping for boat markers
MUNICIPALITY_COLORS = {
    "San Fernando": "#22c55e",  # Green
    "City Of San Fernando": "#22c55e",  # Alias
    "Agoo": "#3b82f6",         # Blue
    "Aringay": "#ef4444",      # Red
    "Bacnotan": "#f59e0b",     # Orange
    "Bagulin": "#8b5cf6",      # Purple
    "Balaoan": "#ec4899",      # Pink
    "Bangar": "#14b8a6",       # Teal
    "Bauang": "#f97316",       # Orange
    "Burgos": "#a855f7",       # Violet
    "Caba": "#06b6d4",         # Cyan
    "Luna": "#84cc16",         # Lime
    "Naguilian": "#eab308",    # Yellow
    "Pugo": "#10b981",         # Emerald
    "Rosario": "#6366f1",      # Indigo
    "San Gabriel": "#d946ef",  # Fuchsia
    "San Juan": "#06b6d4",     # Cyan
    "Santol": "#f43f5e",       # Rose
    "Santo Tomas": "#0ea5e9",  # Sky
    "Sto. Tomas": "#0ea5e9",   # Alias
    "Sudipen": "#64748b",      # Slate
    "Tubao": "#737373",        # Neutral
}

# Alias-safe, case-insensitive color lookup
def _muni_color(name: str) -> str:
    try:
        if not name:
            return "#6b7280"
        key = str(name).strip().lower()
        alias = {
            'san fernando': 'city of san fernando',
            'city of san fernando': 'city of san fernando',
            'sto. tomas': 'santo tomas',
            'santo tomas': 'santo tomas',
        }.get(key, key)
        # Build a lower-key map once
        lower_map = getattr(_muni_color, '_cache', None)
        if lower_map is None:
            lower_map = {k.lower(): v for k, v in MUNICIPALITY_COLORS.items()}
            setattr(_muni_color, '_cache', lower_map)
        return lower_map.get(alias, "#6b7280")
    except Exception:
        return "#6b7280"

def gps_geojson(request):
    features = []

    # Threshold in minutes to consider a device offline (default 3 minutes)
    try:
        threshold_min = int(request.GET.get("threshold", 5))
    except Exception:
        threshold_min = 5
    threshold_seconds = threshold_min * 60
    now = timezone.now()

    # Get the LATEST GPS point for each unique boat (by boat_id, mfbr_number, or tracker_id)
    # This ensures all boats show on the map, not just the last 100 GPS points total
    from django.db.models import Max
    
    logger.info("[GPS_GEOJSON] ===== NEW REQUEST - Fetching latest boat positions =====")
    
    # CRITICAL FIX: Get latest timestamp for each unique tracker/boat combination
    # This ensures multiple trackers don't overwrite each other on the map
    latest_per_tracker = GpsData.objects.values('boat_id', 'mfbr_number', 'tracker_id').annotate(
        latest_time=Max('timestamp')
    )
    
    # Build query to get latest GPS record for each unique tracker
    from django.db.models import Q
    query = Q()
    for item in latest_per_tracker:
        tracker_query = Q(timestamp=item['latest_time'])
        tracker_query &= Q(boat_id=item['boat_id'])
        
        if item['mfbr_number']:
            tracker_query &= Q(mfbr_number=item['mfbr_number'])
        else:
            tracker_query &= Q(mfbr_number__isnull=True)
            
        if item['tracker_id']:
            tracker_query &= Q(tracker_id=item['tracker_id'])
        else:
            tracker_query &= Q(tracker_id__isnull=True)
            
        query |= tracker_query
    
    gps_data = GpsData.objects.filter(query).order_by('-timestamp')
    logger.info(f"[GPS_GEOJSON] Found {gps_data.count()} GPS records")
    
    # Get active violations
    from .models import BoundaryViolationNotification, Municipality, TrackerStatusEvent
    active_violations = set()
    violations = BoundaryViolationNotification.objects.filter(status='pending').values('boat__mfbr_number', 'mfbr_number')
    for v in violations:
        if v['boat__mfbr_number']:
            active_violations.add(v['boat__mfbr_number'])
        if v['mfbr_number']:
            active_violations.add(v['mfbr_number'])
    
    # CRITICAL: Fresh cache per request to avoid stale is_active status
    boat_cache = {}
    tracker_cache = {}
    status_cache = {}  # Cache for TrackerStatusEvent lookups

    for gps in gps_data:
        age_seconds = int((now - gps.timestamp).total_seconds())
        
        # Get tracker_id for status lookup
        trk_id = getattr(gps, 'tracker_id', None)
        
        # Try to get status from TrackerStatusEvent first (matches tracker history)
        status_flag = None
        if trk_id and trk_id not in status_cache:
            # Get the most recent status event for this tracker
            last_status_event = TrackerStatusEvent.objects.filter(tracker_id=trk_id).order_by('-timestamp').first()
            if last_status_event:
                status_cache[trk_id] = last_status_event.status
                logger.info(f"[GPS_GEOJSON] Found status event for tracker {trk_id}: {last_status_event.status}")
            else:
                status_cache[trk_id] = None
                logger.info(f"[GPS_GEOJSON] No status event found for tracker {trk_id}, will use age-based fallback")
        
        if trk_id and status_cache.get(trk_id):
            status_flag = status_cache[trk_id]
            logger.info(f"[GPS_GEOJSON] Using cached status for tracker {trk_id}: {status_flag}")
        else:
            # Fallback to age-based status if no TrackerStatusEvent exists
            status_flag = "online" if age_seconds <= threshold_seconds else "offline"
            logger.info(f"[GPS_GEOJSON] Using age-based status for tracker {trk_id or 'unknown'}: {status_flag} (age: {age_seconds}s)")
        
        mfbr = gps.mfbr_number
        
        # Check if boat is in violation (based on MFBR only to avoid ID type mismatches)
        is_in_violation = bool(mfbr and (mfbr in active_violations))
        
        # Get boat's registered municipality for color coding and icon
        registered_municipality = None
        boat_name = None
        identifier_icon = 'boat'  # Default icon
        
        if mfbr and mfbr not in boat_cache:
            try:
                boat = Boat.objects.filter(mfbr_number=mfbr).first()
                if boat:
                    # Get municipality's identifier_icon
                    muni_obj = Municipality.objects.filter(name=boat.registered_municipality).first()
                    icon_type = muni_obj.identifier_icon if muni_obj and muni_obj.identifier_icon else 'boat'
                    
                    boat_cache[mfbr] = {
                        'registered_municipality': boat.registered_municipality,
                        'boat_name': boat.boat_name,
                        'color': _muni_color(getattr(boat, 'registered_municipality', None)),
                        'identifier_icon': icon_type,
                        'is_active': getattr(boat, 'is_active', True)  # CRITICAL: Add is_active to cache
                    }
                else:
                    boat_cache[mfbr] = None
            except Exception as e:
                logger.error(f"Error fetching boat data for {mfbr}: {e}")
                boat_cache[mfbr] = None
        
        boat_data = boat_cache.get(mfbr) if mfbr else None
        if boat_data:
            registered_municipality = boat_data.get('registered_municipality')
            boat_name = boat_data.get('boat_name')
            boat_is_active = boat_data.get('is_active', True)
            
            # CRITICAL: Skip deactivated boats - don't add to map or WebSocket
            if not boat_is_active:
                logger.warning(f"[GPS_GEOJSON] 🚫 🚫 🚫 SKIPPING DEACTIVATED BOAT: MFBR={mfbr}, Name='{boat_name}' 🚫 🚫 🚫")
                continue  # Skip this boat entirely
            
            # Validate boat name consistency
            if not boat_name or boat_name.strip() == '':
                logger.warning(f"[GPS_GEOJSON] ⚠️ Boat name empty for MFBR {mfbr}, using fallback")
                boat_name = f"Boat {mfbr}"
        else:
            # Fallback: try to get registered municipality from tracker
            try:
                trk_id = getattr(gps, 'tracker_id', None)
                if trk_id:
                    if trk_id not in tracker_cache:
                        from .models import BirukbilugTracker
                        trk = BirukbilugTracker.objects.filter(BirukBilugID=trk_id).first()
                        tracker_cache[trk_id] = trk
                    trk = tracker_cache.get(trk_id)
                    if trk:
                        if trk.municipality:
                            registered_municipality = trk.municipality
                        # If tracker is linked to a Boat, prefer its MFBR for identity and missing fields
                        try:
                            if getattr(trk, "boat", None):
                                if not mfbr and getattr(trk.boat, "mfbr_number", None):
                                    mfbr = trk.boat.mfbr_number
                                if (not boat_name or str(boat_name).strip() == ""):
                                    boat_name = getattr(trk.boat, "boat_name", None) or boat_name
                                if not registered_municipality and getattr(trk.boat, "registered_municipality", None):
                                    registered_municipality = trk.boat.registered_municipality
                        except Exception:
                            pass
            except Exception:
                pass
        
        # Get current municipality for marker color
        current_municipality = None
        try:
            from .boundary_service import boundary_service
            current_municipality = boundary_service.get_municipality_at_point(gps.latitude, gps.longitude)
        except Exception as e:
            logger.warning(f"[GPS_GEOJSON] Could not determine current municipality for MFBR {mfbr}: {e}")
        
        # Determine styling municipality: prefer boat's registered municipality, then tracker municipality, then current location
        style_muni_name = registered_municipality or current_municipality
        marker_color = "#6b7280"
        identifier_icon = 'circle'
        try:
            from .models import Municipality
            if style_muni_name:
                muni_obj = (
                    Municipality.objects.filter(name__iexact=style_muni_name).first()
                    or (
                        Municipality.objects.filter(name__iexact="City Of San Fernando").first()
                        if str(style_muni_name).strip().lower() == "san fernando" else None
                    )
                    or (
                        Municipality.objects.filter(name__iexact="Santo Tomas").first()
                        if str(style_muni_name).strip().lower() in ("sto. tomas", "santo tomas") else None
                    )
                )
                if muni_obj:
                    if getattr(muni_obj, "color", None):
                        marker_color = muni_obj.color
                    else:
                        marker_color = _muni_color(style_muni_name)
                    identifier_icon = getattr(muni_obj, "identifier_icon", None) or 'circle'
                else:
                    marker_color = _muni_color(style_muni_name)
                    identifier_icon = boat_data.get('identifier_icon', 'circle') if boat_data else 'circle'
            else:
                marker_color = _muni_color(current_municipality) if current_municipality else "#6b7280"
                identifier_icon = boat_data.get('identifier_icon', 'circle') if boat_data else 'circle'
        except Exception:
            marker_color = _muni_color(style_muni_name) if style_muni_name else "#6b7280"
            identifier_icon = boat_data.get('identifier_icon', 'circle') if boat_data else 'circle'
        
        # CRITICAL: Use MFBR as primary boat_id for consistent marker tracking
        trk_id = getattr(gps, 'tracker_id', None)
        unique_boat_id = mfbr if mfbr else (trk_id if trk_id else f"boat_{gps.boat_id}")
        
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [gps.longitude, gps.latitude],
            },
            "properties": {
                "boat_id": unique_boat_id,
                "mfbr_number": mfbr,
                "boat_name": boat_name,
                "tracker_id": trk_id,
                "registered_municipality": registered_municipality,
                "marker_color": marker_color,
                "latitude": gps.latitude,
                "longitude": gps.longitude,
                "timestamp": gps.timestamp.isoformat(),
                "status": status_flag,
                "in_violation": is_in_violation,
                "identifier_icon": identifier_icon,
                "age_seconds": age_seconds,
            }
        })

    return JsonResponse({
        "type": "FeatureCollection",
        "features": features,
    })


# === Token-based ingest endpoint for devices (SIM808 etc.) ===
class _IngestValidationError(Exception):
    pass


def _auth_device(request):
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    token = ""
    a = auth.lower().strip()
    if a.startswith("bearer "):
        token = auth[7:].strip()
    elif a.startswith("token "):
        token = auth[6:].strip()
    elif a.startswith("device "):
        token = auth[7:].strip()
    if not token:
        token = request.META.get("HTTP_X_DEVICE_TOKEN", "").strip()
    if not token:
        try:
            body = getattr(request, 'data', {}) or {}
        except Exception:
            body = {}
        token = (body.get('token') or body.get('device_token') or body.get('auth_token') or '').strip()
    if not token:
        raise _IngestValidationError("Missing device token")
    try:
        device = DeviceToken.objects.get(token=token, is_active=True)
        return device
    except DeviceToken.DoesNotExist:
        raise _IngestValidationError("Invalid device token")


import time

# Throttle per-boat broadcast to avoid spamming WebSocket (1 Hz)
_LAST_BROADCAST = {}
_BROADCAST_WINDOW_SEC = 1.0

@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])  
@csrf_exempt
def ingest_positions(request):
    import time
    from django.utils import timezone as dj_tz
    start_time = time.time()
    connection_status = "stable"
    
    try:
        device = _auth_device(request)
        if device.last_seen_at:
            time_since_last = dj_tz.now() - device.last_seen_at
            if time_since_last.total_seconds() > 600:
                connection_status = "reconnected_after_outage"
            elif time_since_last.total_seconds() > 90:  # Reduced from 120s: trackers posting every 60s will be stable
                connection_status = "irregular"
    except _IngestValidationError as e:
        return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

    lat = request.data.get("lat") or request.data.get("latitude")
    lng = request.data.get("lng") or request.data.get("longitude")
    device_id = request.data.get("device_id") or None
    boat_id = request.data.get("boat_id") or device.boat_id or 0
    mfbr = request.data.get("mfbr") or request.data.get("mfbr_number") or request.data.get("mfbrNo") or None
    
    # CRITICAL FIX: Use device_id as unique tracker identifier when boat_id is default (0)
    # This prevents multiple ESP32 trackers from overwriting each other on the map
    if boat_id == 0 and device_id:
        # Create a unique boat_id from device_id hash to ensure map uniqueness
        import hashlib
        boat_id = int(hashlib.md5(device_id.encode()).hexdigest()[:8], 16) % 999999 + 100000

    try:
        lat = float(lat)
        lng = float(lng)
    except Exception:
        return Response({"error": "lat/lng required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        boat_id = int(boat_id) if boat_id is not None else 0
    except Exception:
        boat_id = 0

    tracker = getattr(device, 'tracker', None)
    tracker_id = None
    if tracker:
        tracker_id = tracker.BirukBilugID
        if getattr(tracker, 'boat', None) and getattr(tracker.boat, 'mfbr_number', None):
            mfbr = mfbr or tracker.boat.mfbr_number

    gps_data = GpsData.objects.create(
        latitude=lat,
        longitude=lng,
        boat_id=boat_id,
        mfbr_number=mfbr,
        tracker_id=tracker_id,
    )
    DeviceToken.objects.filter(pk=device.pk).update(last_seen_at=timezone.now())
    
    # Record status transition using state machine
    actual_status = 'online'  # Default for WebSocket
    if tracker_id:
        from .models import TrackerStatusEvent
        
        # Get time since last seen for debugging
        time_since_last_str = "N/A"
        if device.last_seen_at:
            time_since_last = dj_tz.now() - device.last_seen_at
            time_since_last_str = f"{time_since_last.total_seconds():.1f}s"
        
        # Determine current status based on connection
        current_status = 'online'  # Default: receiving data means online
        if connection_status == "reconnected_after_outage":
            # Was offline (600+ seconds), now back
            current_status = 'online'  # Will become 'reconnected' if previous was offline
        elif connection_status == "irregular":
            current_status = 'reconnecting'  # Intermittent signal
        
        logger.info(f"[STATUS_DEBUG] Tracker {tracker_id}: connection_status={connection_status}, time_since_last={time_since_last_str}, determined_status={current_status}")
        
        # Record the transition (state machine will handle deduplication)
        event, created = TrackerStatusEvent.record_transition(
            tracker_id=tracker_id,
            new_status=current_status,
            timestamp=gps_data.timestamp,
            mfbr_number=mfbr,
            boat_id=boat_id,
            latitude=lat,
            longitude=lng
        )
        
        if created and event:
            logger.info(f"[STATUS_DEBUG] ✅ Transition recorded: {tracker_id} → {event.status} (from {event.previous_status})")
            actual_status = event.status  # Use the recorded status for WebSocket
        else:
            # No transition, check what the current status is
            last_event = TrackerStatusEvent.objects.filter(tracker_id=tracker_id).order_by('-timestamp').first()
            if last_event:
                actual_status = last_event.status
                logger.info(f"[STATUS_DEBUG] No transition (status unchanged), using last status: {actual_status}")
            else:
                logger.warning(f"[STATUS_DEBUG] No transition and no previous status event found for {tracker_id}")
    
    crossing_result = None
    beep_flag = False
    beep_duration = 5
    
    # Check boundary crossing and violations using existing logic
    # Your existing logic: 15-min dwell + clears if boat returns home ("just passing through")
    if mfbr and tracker_id:
        try:
            from .boundary_service import check_and_notify_boundary_crossing
            
            logger.info(f"[BOUNDARY_CHECK] Checking crossing for {mfbr} at ({lat},{lng})")
            crossing_result = check_and_notify_boundary_crossing(
                boat_id=boat_id,
                latitude=lat,
                longitude=lng,
                mfbr_number=mfbr,
                tracker_id=tracker_id
            )
            
            if crossing_result:
                if crossing_result.get('crossing_detected'):
                    logger.info(f"[BOUNDARY] ✅ Crossing detected for {mfbr}: {crossing_result.get('from_municipality')} → {crossing_result.get('to_municipality')}")
                
                # Check if violation alert was sent (boat dwelled 15+ mins)
                if crossing_result.get('dwell_alert_sent'):
                    logger.warning(f"[BOUNDARY] 🚨 VIOLATION ALERT for {mfbr}: Dwelled 15+ minutes in {crossing_result.get('to_municipality')}")
                    beep_flag = True
                    beep_duration = 10  # Longer beep for violation
        except Exception as e:
            logger.error(f"[BOUNDARY] Error checking boundary crossing for {mfbr}: {e}", exc_info=True)
    
    # Broadcast via WebSocket
    channel_layer = get_channel_layer()
    if channel_layer:
        now = time.time()
        # CRITICAL FIX: Create temporary unique ID for throttling check
        temp_unique_id = mfbr if mfbr else (tracker_id if tracker_id else f"device_{boat_id}")
        last = _LAST_BROADCAST.get(temp_unique_id)
        if (last is None) or (now - last >= _BROADCAST_WINDOW_SEC):
            
            from .models import BoundaryViolationNotification
            is_in_violation = BoundaryViolationNotification.objects.filter(
                Q(boat__mfbr_number=mfbr) | Q(mfbr_number=mfbr),
                status='pending'
            ).exists() if mfbr else False
            
            boat_name = None
            registered_municipality = None
            
            current_municipality = None
            try:
                from .boundary_service import boundary_service
                current_municipality = boundary_service.get_municipality_at_point(lat, lng)
            except Exception as e:
                logger.warning(f"Could not determine current municipality: {e}")
            
            # Determine styling municipality: prefer boat's registered municipality, then tracker municipality, then current location
            marker_color = "#6b7280"
            boat_is_active = True
            identifier_icon = 'circle'
            
            if mfbr:
                try:
                    boat = Boat.objects.filter(mfbr_number__iexact=mfbr).first()
                    if boat:
                        boat_is_active = getattr(boat, 'is_active', True)
                        registered_municipality = boat.registered_municipality
                        boat_name = str(boat.boat_name).strip() if boat.boat_name else None
                        logger.info(f"[GPS_INGEST] Boat lookup result: MFBR={mfbr}, boat_name={boat_name}, registered_municipality={registered_municipality}, is_active={boat_is_active}")
                except Exception as e:
                    logger.error(f"Boat lookup error for {mfbr}: {e}")
            
            style_muni_name = registered_municipality
            if not style_muni_name and tracker and hasattr(tracker, 'municipality') and tracker.municipality:
                style_muni_name = tracker.municipality
            if not style_muni_name:
                style_muni_name = current_municipality
            
            try:
                if style_muni_name:
                    alias = str(style_muni_name).strip().lower()
                    muni_obj = (
                        Municipality.objects.filter(name__iexact=style_muni_name).first()
                        or (Municipality.objects.filter(name__iexact="City Of San Fernando").first() if alias == "san fernando" else None)
                        or (Municipality.objects.filter(name__iexact="Santo Tomas").first() if alias in ("sto. tomas", "santo tomas") else None)
                    )
                    if muni_obj:
                        if getattr(muni_obj, 'color', None):
                            marker_color = muni_obj.color
                        else:
                            marker_color = _muni_color(style_muni_name)
                        identifier_icon = getattr(muni_obj, 'identifier_icon', None) or 'circle'
                    else:
                        marker_color = _muni_color(style_muni_name)
                # ESP32 testing convenience
                if marker_color == "#6b7280" and device_id and device_id.startswith(("BAC-", "TEST-")):
                    default_muni = Municipality.objects.filter(name="San Fernando").first()
                    if default_muni:
                        registered_municipality = registered_municipality or "San Fernando"
                        marker_color = default_muni.color if default_muni.color else "#3B82F6"
                        identifier_icon = default_muni.identifier_icon if default_muni.identifier_icon else 'circle'
            except Exception as e:
                logger.error(f"Municipality styling error: {e}")
            
            # CRITICAL: Skip WebSocket broadcast for deactivated boats
            if not boat_is_active:
                logger.warning(f"[GPS_INGEST] 🚫 Skipping WebSocket broadcast for deactivated boat: MFBR={mfbr}")
                # Don't broadcast but GPS data is already saved for historical records
            else:
                logger.info(f"[GPS_INGEST] ✅ Broadcasting GPS update: tracker_id={tracker_id}, MFBR={mfbr}, lat={lat}, lng={lng}, status={actual_status}")
                # Boat is active, proceed with WebSocket broadcast
                if not boat_name and tracker and hasattr(tracker, 'boat_name'):
                    boat_name = tracker.boat_name
                elif not boat_name and mfbr:
                    boat_name = f"Boat {mfbr}"
                elif not boat_name and device_id:
                    # CRITICAL FIX: Fallback name for device-only trackers
                    boat_name = f"Tracker {device_id}"
                elif not boat_name:
                    boat_name = f"Device {boat_id}"
                
                # Use MFBR if available, then tracker_id, then the corrected boat_id (includes device_id hash)
                unique_boat_id = mfbr if mfbr else (tracker_id if tracker_id else f"device_{boat_id}")
                
                # CRITICAL FIX: Update broadcast throttling to use unique_boat_id instead of boat_id
                # This prevents different trackers from interfering with each other's broadcasts
                _LAST_BROADCAST[unique_boat_id] = now
                
                gps_feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    },
                    "properties": {
                        "boat_id": unique_boat_id,
                        "mfbr_number": mfbr,
                        "boat_name": boat_name,
                        "tracker_id": tracker_id,
                        "registered_municipality": registered_municipality,
                        "marker_color": marker_color,
                        "latitude": lat,
                        "longitude": lng,
                        "timestamp": gps_data.timestamp.isoformat(),
                        "status": actual_status,
                        "in_violation": is_in_violation,
                        "identifier_icon": identifier_icon,  # Use Municipality's icon for consistency
                    }
                }
                try:
                    async_to_sync(channel_layer.group_send)(
                        'gps_updates',
                        {
                            'type': 'gps_update',
                            'data': {
                                "type": "FeatureCollection",
                                "features": [gps_feature]
                            }
                        }
                    )
                    logger.info(f"[GPS_INGEST] 📡 WebSocket broadcast successful for {unique_boat_id}")
                except Exception as ws_error:
                    logger.error(f"[GPS_INGEST] ❌ WebSocket broadcast error: {ws_error}")
    
    total_processing_time = (time.time() - start_time) * 1000
    diagnostics = {
        "processing_time_ms": round(total_processing_time, 2),
        "connection_quality": connection_status,
        "gps_coordinates_valid": True,
        "server_timestamp": dj_tz.now().isoformat(),
    }
    
    response_data = {
        "status": "ok",
        "beep": beep_flag,
        "beep_duration": beep_duration if beep_flag else 0,
        "connectivity": diagnostics,
        "data_stored": {
            "gps_id": gps_data.id,
            "timestamp": gps_data.timestamp.isoformat(),
            "coordinates": {"lat": lat, "lng": lng},
            "boat_id": boat_id,
            "mfbr_number": mfbr,
            "tracker_id": tracker_id
        }
    }
    
    if crossing_result:
        response_data["boundary_crossing"] = {
            "detected": crossing_result.get('crossing_detected', False),
            "violation_alert": crossing_result.get('dwell_alert_sent', False),
            "from_municipality": crossing_result.get('from_municipality'),
            "to_municipality": crossing_result.get('to_municipality')
        }
    
    return Response(response_data, status=status.HTTP_201_CREATED)


# @csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    print(f"Password reset request received: {request.data}")
    email = request.data.get('email')
    
    if not email:
        print("No email provided in request")
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email.lower())
        
        # Generate token and encode user id
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # Get the name for the email
        if user.user_role == 'provincial_agriculturist' and user.provincial_agriculturist:
            first_name = user.provincial_agriculturist.first_name
        elif user.user_role == 'municipal_agriculturist' and user.municipal_agriculturist:
            first_name = user.municipal_agriculturist.first_name
        else:
            first_name = 'User'
        
        # Create reset link - update this to your frontend URL
        # For development across different computers, use your IP address instead of localhost
        # Example: http://192.168.1.100:5173 (replace with your actual IP)
        frontend_url = request.data.get('frontend_url', 'http://localhost:5173')
        
        # Override with environment variable if set (for production or network testing)
        import os
        if os.environ.get('FRONTEND_BASE_URL'):
            frontend_url = os.environ.get('FRONTEND_BASE_URL')
            
        reset_link = f"{frontend_url}/reset-password/{uid}/{token}"
        
        # Send email with better formatting
        subject = "Password Reset Request - Bangka System"
        message = f"""
        Dear {first_name},

        You have requested to reset your password for the Bangka System.

        Please click the link below to reset your password:
        {reset_link}

        This link will expire in 24 hours for security reasons.

        If you did not request this password reset, please ignore this email.

        Best regards,
        Bangka System Team
        """
        
        from_email = settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@bangka.com'
        send_mail(subject, message, from_email, [email], fail_silently=False)
        
        return Response({
            'message': 'Password reset link has been sent to your email',
            'email': email
        }, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        # Don't reveal if email exists or not for security
        return Response({
            'message': 'If the email exists in our system, you will receive a password reset link',
            'email': email
        }, status=status.HTTP_200_OK)
    except Exception as e:
        print(f"Error sending password reset email: {str(e)}")
        return Response({'error': 'Failed to send password reset email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_confirm(request, uidb64, token):
    try:
        # Decode the user id
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
        
        # Check if token is valid
        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired reset link'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get passwords from request
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password:
            return Response({'error': 'Current password is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({'error': 'New password is required'}, status=status.HTTP_400_BAD_REQUEST)
        if len(str(new_password)) < 6:
            return Response({'error': 'Password must be at least 6 characters long'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify current password
        if not user.check_password(current_password):
            return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent reusing the old password
        if current_password == new_password or user.check_password(new_password):
            return Response({'error': 'New password cannot be the same as the current password'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Set the new password
        user.set_password(new_password)
        user.save()
        
        # Send confirmation email
        try:
            if user.user_role == 'provincial_agriculturist' and user.provincial_agriculturist:
                first_name = user.provincial_agriculturist.first_name
            elif user.user_role == 'municipal_agriculturist' and user.municipal_agriculturist:
                first_name = user.municipal_agriculturist.first_name
            else:
                first_name = 'User'
                
            subject = "Password Reset Successful - Bangka System"
            message = f"""
            Dear {first_name},

            Your password for the Bangka System has been successfully reset.

            You can now log in with your new password at:
            http://localhost:5173/login

            If you did not make this change, please contact your administrator immediately.

            Best regards,
            Bangka System Team
            """
            
            from_email = settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@bangka.com'
            send_mail(subject, message, from_email, [user.email], fail_silently=True)
        except:
            pass  # Don't fail if confirmation email doesn't send
        
        return Response({'message': 'Password has been reset successfully'}, status=status.HTTP_200_OK)
        
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({'error': 'Invalid reset link'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        print(f"Error resetting password: {str(e)}")
        return Response({'error': 'Failed to reset password'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def gps_data(request):
    if request.method == 'POST':
        print("📥 Request received at /api/gps/ ✅")
        print("\n======= Incoming POST Request =======")
        print("Raw body:", request.body)
        print("Content-Type:", request.headers.get("Content-Type"))
        print("POST dict:", request.POST)

        latitude = None
        longitude = None
        boat_id = None

        if request.headers.get("Content-Type") == "application/json":
            try:
                data = json.loads(request.body)
                latitude = data.get('latitude')
                longitude = data.get('longitude')
                boat_id = data.get('boat_id')
            except Exception as e:
                print("JSON parsing error:", e)
        else:
            latitude = request.POST.get('latitude')
            longitude = request.POST.get('longitude')
            boat_id = request.POST.get('boat_id')

        print("Parsed values -> Latitude:", latitude, "Longitude:", longitude, "Boat ID:", boat_id)

        try:
            gps = GpsData.objects.create(
                latitude=float(latitude),   
                longitude=float(longitude),
                boat_id=int(boat_id)
            )
            
            # Check for boundary crossing and send SMS notifications
            violation_detected = False
            try:
                crossing_result = check_and_notify_boundary_crossing(int(boat_id), float(latitude), float(longitude))
                if crossing_result and crossing_result.get('crossing_detected'):
                    print(f"🚨 Boundary crossing detected for boat {boat_id}: {crossing_result}")
                    violation_detected = crossing_result.get('violation_created', False)
            except Exception as boundary_error:
                # Don't fail the GPS ingestion if boundary checking fails
                print(f"❌ Boundary checking error: {boundary_error}")
            
            # Broadcast GPS update via WebSocket
            channel_layer = get_channel_layer()
            if channel_layer:
                try:
                    # Check if this boat has active violations
                    has_active_violation = BoundaryViolationNotification.objects.filter(
                        boat_id=int(boat_id),
                        status='pending'
                    ).exists()
                    
                    gps_update = {
                        'type': 'FeatureCollection',
                        'features': [{
                            'type': 'Feature',
                            'geometry': {
                                'type': 'Point',
                                'coordinates': [float(longitude), float(latitude)]
                            },
                            'properties': {
                                'boat_id': int(boat_id),
                                'timestamp': gps.timestamp.isoformat(),
                                'status': 'online',
                                'age_seconds': 0,
                                'in_violation': has_active_violation
                            }
                        }]
                    }
                    
                    async_to_sync(channel_layer.group_send)(
                        'gps_updates',
                        {
                            'type': 'gps_update',
                            'data': gps_update
                        }
                    )
                    print(f"📡 Broadcasted GPS update for boat {boat_id} via WebSocket")
                except Exception as ws_error:
                    print(f"❌ WebSocket broadcast error: {ws_error}")
            
            return JsonResponse({'status': 'success'})
        except Exception as e:
            print("❌ Error:", str(e))
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Only POST method allowed'}, status=405)




# Helper function to generate temporary password
import string
import random

def generate_temporary_password(length=6):
    """Generate a random alphanumeric password of given length (default 6)."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))

class BoatMeasurementsViewSet(viewsets.ModelViewSet):
    queryset = BoatMeasurements.objects.all()
    serializer_class = BoatMeasurementsSerializer

class BoatGearAssignmentViewSet(viewsets.ModelViewSet):
    queryset = BoatGearAssignment.objects.all()
    serializer_class = BoatGearAssignmentSerializer


class BoatGearTypeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = BoatGearTypeAssignment.objects.all()
    serializer_class = BoatGearTypeAssignmentSerializer

    def perform_create(self, serializer):
        print("DEBUG GearTypeAssignment saving:", serializer.validated_data)
        return super().perform_create(serializer)


class BoatGearSubtypeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = BoatGearSubtypeAssignment.objects.all()
    serializer_class = BoatGearSubtypeAssignmentSerializer

    def perform_create(self, serializer):
        print("DEBUG GearSubtypeAssignment saving:", serializer.validated_data)
        return super().perform_create(serializer)


class BoatMeasurementsViewSet(viewsets.ModelViewSet):
    queryset = BoatMeasurements.objects.all()
    serializer_class = BoatMeasurementsSerializer


class GearTypeViewSet(viewsets.ModelViewSet):
    queryset = GearType.objects.all()
    serializer_class = GearTypeSerializer


class GearSubtypeViewSet(viewsets.ModelViewSet):
    queryset = GearSubtype.objects.all()
    serializer_class = GearSubtypeSerializer
    
class AddressViewSet(viewsets.ModelViewSet):
    queryset = Address.objects.all()
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter addresses by fisherfolk registration number if provided in query params.
        """
        queryset = super().get_queryset()
        fisherfolk_reg = self.request.query_params.get('fisherfolk')
        
        if fisherfolk_reg:
            queryset = queryset.filter(fisherfolk__registration_number=fisherfolk_reg)
            
        return queryset

class HouseholdViewSet(viewsets.ModelViewSet):
    queryset = Household.objects.all()
    serializer_class = HouseholdSerializer
    permission_classes = [IsAuthenticated]

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

class ContactsViewSet(viewsets.ModelViewSet):
    queryset = Contacts.objects.all()
    serializer_class = ContactsSerializer
    permission_classes = [IsAuthenticated]


class GearTypeViewSet(viewsets.ModelViewSet):
    queryset = GearType.objects.all()
    serializer_class = GearTypeSerializer
    permission_classes = [IsAuthenticated]

class GearSubtypeViewSet(viewsets.ModelViewSet):
    queryset = GearSubtype.objects.all()
    serializer_class = GearSubtypeSerializer
    permission_classes = [IsAuthenticated]

class MunicipalityBoundaryViewSet(viewsets.ModelViewSet):
    queryset = MunicipalityBoundary.objects.all()
    serializer_class = MunicipalityBoundarySerializer
    
class ImportFisherfolkExcelView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file_obj)
        except Exception as e:
            return Response({"error": f"Failed to read Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ Get default admin user for created_by
        User = get_user_model()
        default_user = User.objects.filter(is_superuser=True).first()
        if not default_user:
            return Response({"error": "No superuser found. Please create an admin user first."}, status=status.HTTP_400_BAD_REQUEST)

        core_required = [
            "registration_number", "last_name", "first_name", "birth_date",
            "sex", "contact_number", "birth_place", "civil_status", "nationality"
        ]
        
        missing_core = [col for col in core_required if col not in df.columns]
        if missing_core:
            return Response(
                {"error": f"Missing required columns: {', '.join(missing_core)}", "missing_columns": missing_core},
                status=status.HTTP_400_BAD_REQUEST
            )

        imported, skipped, errors, warnings = 0, 0, [], []
        
        def safe_get(row, col, default=None):
            if col not in df.columns:
                return default
            val = row.get(col)
            if pd.isna(val) or (isinstance(val, str) and val.strip() == ""):
                return default
            return val
        
        def clean_bool(val):
            if pd.isna(val): return False
            if isinstance(val, bool): return val
            if isinstance(val, (int, float)): return bool(val)
            if isinstance(val, str): return val.strip().lower() in ('true', 'yes', '1', 'y')
            return False

        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                fisherfolk_data = {}
                for field in core_required:
                    fisherfolk_data[field] = safe_get(row, field)
                fisherfolk_data["salutations"] = safe_get(row, "salutations", "")
                fisherfolk_data["middle_name"] = safe_get(row, "middle_name", "")
                fisherfolk_data["appelation"] = safe_get(row, "appelation", "")
                fisherfolk_data["age"] = safe_get(row, "age", None)
                fisherfolk_data["fisherfolk_status"] = safe_get(row, "fisherfolk_status", "")
                fisherfolk_data["mothers_maidenname"] = safe_get(row, "mothers_maidenname", "")
                fisherfolk_data["fishing_ground"] = safe_get(row, "fishing_ground", "")
                fisherfolk_data["fma_number"] = safe_get(row, "fma_number", "")
                fisherfolk_data["religion"] = safe_get(row, "religion", "")
                fisherfolk_data["educational_background"] = safe_get(row, "educational_background", "")
                fisherfolk_data["household_month_income"] = safe_get(row, "household_month_income", "")
                fisherfolk_data["other_source_income"] = safe_get(row, "other_source_income", "")
                fisherfolk_data["farming_income"] = clean_bool(safe_get(row, "farming_income", False))
                fisherfolk_data["farming_income_salary"] = safe_get(row, "farming_income_salary", None)
                fisherfolk_data["fisheries_income"] = clean_bool(safe_get(row, "fisheries_income", False))
                fisherfolk_data["fisheries_income_salary"] = safe_get(row, "fisheries_income_salary", None)
                fisherfolk_data["with_voterID"] = clean_bool(safe_get(row, "with_voterID", False))
                fisherfolk_data["voterID_number"] = safe_get(row, "voterID_number", "")
                fisherfolk_data["is_CCT_4ps"] = clean_bool(safe_get(row, "is_CCT_4ps", False))
                fisherfolk_data["is_ICC"] = clean_bool(safe_get(row, "is_ICC", False))
                fisherfolk_data["main_source_livelihood"] = safe_get(row, "main_source_livelihood", "")
                fisherfolk_data["other_source_livelihood"] = safe_get(row, "other_source_livelihood", "")

                if fisherfolk_data.get("contact_number"):
                    num = str(fisherfolk_data["contact_number"]).strip()
                    if "." in num: num = num.split(".")[0]
                    if num and not num.startswith(("09", "+639")):
                        if num.startswith("9") and len(num) == 10: num = "0" + num
                    fisherfolk_data["contact_number"] = num
                
                birth_date_raw = fisherfolk_data.get("birth_date")
                if birth_date_raw:
                    try:
                        if hasattr(birth_date_raw, "strftime"):
                            fisherfolk_data["birth_date"] = birth_date_raw.strftime("%Y-%m-%d")
                        else:
                            parsed = pd.to_datetime(birth_date_raw, errors="coerce")
                            if pd.notnull(parsed):
                                fisherfolk_data["birth_date"] = parsed.strftime("%Y-%m-%d")
                    except: pass
                
                if not fisherfolk_data["registration_number"]:
                    skipped += 1
                    errors.append({"row": row_num, "errors": {"registration_number": "Required"}})
                    continue
                if not fisherfolk_data["birth_date"]:
                    skipped += 1
                    errors.append({"row": row_num, "errors": {"birth_date": "Required or invalid"}})
                    continue

                main_fields = [
                    "registration_number", "salutations", "last_name", "first_name",
                    "middle_name", "appelation", "birth_date", "age", "birth_place",
                    "civil_status", "sex", "contact_number", "nationality",
                    "fisherfolk_status", "mothers_maidenname", "fishing_ground",
                    "fma_number", "religion", "educational_background",
                    "household_month_income", "other_source_income", "farming_income",
                    "farming_income_salary", "fisheries_income", "fisheries_income_salary",
                    "with_voterID", "voterID_number", "is_CCT_4ps", "is_ICC",
                    "main_source_livelihood", "other_source_livelihood"
                ]
                fisherfolk_core = {field: fisherfolk_data[field] for field in main_fields}
                # Pass request context so serializer can access user for created_by
                serializer = FisherfolkSerializer(data=fisherfolk_core, context={'request': request})
                if serializer.is_valid():
                    fisherfolk = serializer.save(created_by=default_user)
                    imported += 1
                    address_data = {f: safe_get(row, f, "") for f in ["street", "barangay", "municipality", "province", "region", "residency_years", "barangay_verifier", "position"]}
                    verified_date_raw = safe_get(row, "verified_date")
                    if verified_date_raw:
                        try:
                            if hasattr(verified_date_raw, "strftime"): address_data["verified_date"] = verified_date_raw.strftime("%Y-%m-%d")
                            else:
                                parsed = pd.to_datetime(verified_date_raw, errors="coerce")
                                if pd.notnull(parsed): address_data["verified_date"] = parsed.strftime("%Y-%m-%d")
                        except: pass
                    if any(v for v in address_data.values() if v):
                        try: Address.objects.create(fisherfolk=fisherfolk, **address_data)
                        except: pass
                    household_data = {f: safe_get(row, f, 0) for f in ["total_no_household_memb", "no_male", "no_female", "no_children", "no_in_school", "no_out_school", "no_employed", "no_unemployed"]}
                    if any(household_data.values()):
                        try: Household.objects.create(fisherfolk=fisherfolk, **household_data)
                        except: pass
                    org_name = safe_get(row, "org_name", "")
                    if org_name:
                        try:
                            member_since_raw = safe_get(row, "member_since")
                            member_since = None
                            if member_since_raw:
                                try:
                                    if hasattr(member_since_raw, "strftime"): member_since = member_since_raw.strftime("%Y-%m-%d")
                                    else:
                                        parsed = pd.to_datetime(member_since_raw, errors="coerce")
                                        if pd.notnull(parsed): member_since = parsed.strftime("%Y-%m-%d")
                                except: pass
                            Organization.objects.create(fisherfolk=fisherfolk, org_name=org_name, member_since=member_since, org_position=safe_get(row, "org_position", ""))
                        except: pass
                    contact_data = {f: safe_get(row, f, "") for f in ["contact_fname", "contact_lname", "contact_mname", "contact_relationship", "contact_municipality", "contact_barangay"]}
                    contact_contactno_raw = safe_get(row, "contact_contactno", "")
                    if contact_contactno_raw:
                        num = str(contact_contactno_raw).strip()
                        if "." in num: num = num.split(".")[0]
                        if num and not num.startswith(("09", "+639")):
                            if num.startswith("9") and len(num) == 10: num = "0" + num
                        contact_data["contact_contactno"] = num
                    if any(v for v in contact_data.values() if v):
                        try: Contacts.objects.create(fisherfolk=fisherfolk, **contact_data)
                        except: pass
                else:
                    skipped += 1
                    errors.append({"row": row_num, "errors": serializer.errors})
            except Exception as e:
                skipped += 1
                errors.append({"row": row_num, "errors": {"exception": str(e)}})

        response_data = {"imported": imported, "skipped": skipped, "total_rows": len(df), "errors": errors, "warnings": warnings}
        return Response(response_data, status=status.HTTP_200_OK if imported > 0 else status.HTTP_400_BAD_REQUEST)

class ImportBoatExcelView(APIView):
    """Enhanced Excel import for Boats"""
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file_obj, engine=None)
        except Exception as e:
            return Response({"error": f"Failed to read Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        core_required = ["mfbr_number", "boat_name", "fisherfolk_registration_number",
                        "application_date", "type_of_registration", "type_of_ownership",
                        "boat_type", "fishing_ground", "fma_number", "built_place",
                        "no_fishers", "material_used", "homeport", "built_year"]

        missing_core = [col for col in core_required if col not in df.columns]
        if missing_core:
            return Response({"error": f"Missing required columns: {', '.join(missing_core)}",
                           "missing_columns": missing_core}, status=status.HTTP_400_BAD_REQUEST)

        imported, skipped, errors = 0, 0, []

        def safe_get(row, col, default=None):
            if col not in df.columns:
                return default
            val = row.get(col)
            return default if pd.isna(val) or (isinstance(val, str) and val.strip() == "") else val

        def clean_date(date_val):
            if not date_val or pd.isna(date_val):
                return None
            try:
                if hasattr(date_val, "strftime"):
                    return date_val.strftime("%Y-%m-%d")
                parsed = pd.to_datetime(date_val, errors="coerce")
                return parsed.strftime("%Y-%m-%d") if pd.notnull(parsed) else None
            except:
                return None

        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                fisherfolk_reg = safe_get(row, "fisherfolk_registration_number")
                if not fisherfolk_reg:
                    skipped += 1
                    errors.append({"row": row_num, "errors": {"fisherfolk_registration_number": "Required"}, "type": "validation"})
                    continue

                try:
                    fisherfolk = Fisherfolk.objects.get(registration_number=fisherfolk_reg)
                except Fisherfolk.DoesNotExist:
                    skipped += 1
                    errors.append({"row": row_num, "errors": {"fisherfolk_registration_number": f"Fisherfolk '{fisherfolk_reg}' not found"}, "type": "validation"})
                    continue

                boat_data = {
                    "mfbr_number": safe_get(row, "mfbr_number"),
                    "boat_name": safe_get(row, "boat_name", "Unnamed"),
                    "fisherfolk_registration_number": fisherfolk,
                    "application_date": clean_date(safe_get(row, "application_date")),
                    "type_of_registration": safe_get(row, "type_of_registration"),
                    "type_of_ownership": safe_get(row, "type_of_ownership"),
                    "boat_type": safe_get(row, "boat_type"),
                    "fishing_ground": safe_get(row, "fishing_ground"),
                    "fma_number": safe_get(row, "fma_number"),
                    "built_place": safe_get(row, "built_place"),
                    "no_fishers": safe_get(row, "no_fishers", 0),
                    "material_used": safe_get(row, "material_used"),
                    "homeport": safe_get(row, "homeport"),
                    "built_year": safe_get(row, "built_year"),
                    "engine_make": safe_get(row, "engine_make", ""),
                    "serial_number": safe_get(row, "serial_number", ""),
                    "horsepower": safe_get(row, "horsepower", "")
                }

                if not boat_data["application_date"]:
                    skipped += 1
                    errors.append({"row": row_num, "errors": {"application_date": "Required or invalid format"}, "type": "validation"})
                    continue

                Boat.objects.create(**boat_data)
                imported += 1

            except Exception as e:
                skipped += 1
                errors.append({"row": row_num, "errors": {"exception": str(e)}, "type": "exception"})

        return Response({"imported": imported, "skipped": skipped, "total_rows": len(df), "errors": errors},
                       status=status.HTTP_200_OK if imported > 0 else status.HTTP_400_BAD_REQUEST)
                       
# Municipality Management ViewSets
class MunicipalityViewSet(viewsets.ModelViewSet):
    queryset = Municipality.objects.all()
    serializer_class = MunicipalitySerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Allow all authenticated users to list/retrieve, only admins can modify"""
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]
    
    def _generate_unique_prefix(self, municipality_name, exclude_id=None):
        """Generate a unique 3-letter prefix from municipality name"""
        # Generate base prefix from first 3 letters
        base_prefix = municipality_name[:3].upper()
        prefix = base_prefix
        
        # Check for uniqueness
        counter = 1
        queryset = Municipality.objects.filter(prefix=prefix)
        if exclude_id:
            queryset = queryset.exclude(municipality_id=exclude_id)
        
        while queryset.exists():
            # If prefix exists, append number
            if counter < 10:
                prefix = base_prefix[:2] + str(counter)
            else:
                prefix = base_prefix[0] + str(counter)
            counter += 1
            queryset = Municipality.objects.filter(prefix=prefix)
            if exclude_id:
                queryset = queryset.exclude(municipality_id=exclude_id)
        
        return prefix
    
    def perform_create(self, serializer):
        """Auto-generate prefix when creating municipality"""
        municipality_name = serializer.validated_data.get('name', '')
        prefix = self._generate_unique_prefix(municipality_name)
        serializer.save(prefix=prefix)
    
    def perform_update(self, serializer):
        """Auto-regenerate prefix if name changes"""
        instance = serializer.instance
        new_name = serializer.validated_data.get('name', instance.name)
        
        # If name changed, regenerate prefix
        if new_name != instance.name:
            prefix = self._generate_unique_prefix(new_name, exclude_id=instance.municipality_id)
            serializer.save(prefix=prefix)
        else:
            serializer.save()
    
    def get_queryset(self):
        queryset = Municipality.objects.all().prefetch_related('barangays')
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Search by name
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        return queryset.order_by('name')
    
    @action(detail=False, methods=['get'], url_path='coastal')
    def coastal(self, request):
        """Return list of municipalities explicitly marked coastal (is_coastal=True).
        Query params:
        - fields=... optional comma-separated fields. Defaults to: municipality_id,name,prefix,color,identifier_icon,is_active
        """
        logger = logging.getLogger(__name__)
        try:
            fields_param = request.query_params.get('fields')
            base_fields = ['municipality_id', 'name', 'prefix', 'color', 'identifier_icon', 'is_active']
            fields = [f.strip() for f in fields_param.split(',')] if fields_param else base_fields

            qs = Municipality.objects.filter(is_coastal=True).values(*fields).order_by('name')
            results = list(qs)

            logger.info("Coastal municipalities fetched via flag: %d", len(results))
            return Response({'count': len(results), 'results': results})
        except DatabaseError:
            logger.exception("DB error while fetching coastal municipalities")
            return Response({'error': 'Database temporarily unavailable.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            logger.exception("Unexpected error while fetching coastal municipalities")
            return Response({'error': 'Unexpected error occurred.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], url_path='all-with-coastal')
    def all_with_coastal(self, request):
        """Return all municipalities with both stored is_coastal and computed has_water_boundary."""
        logger = logging.getLogger(__name__)
        try:
            mb_sub = MunicipalityBoundary.objects.filter(
                municipality_id=OuterRef('municipality_id')
            ).filter(Q(coastline_length__gt=0) | Q(water_area__gt=0))

            qs = (
                Municipality.objects
                .annotate(has_water_boundary=Exists(mb_sub))
                .values('municipality_id', 'name', 'prefix', 'color', 'identifier_icon', 'is_active', 'is_coastal', 'has_water_boundary')
                .order_by('name')
            )
            results = list(qs)
            logger.info("All municipalities fetched with computed coastal flag: %d", len(results))
            return Response({'count': len(results), 'results': results})
        except DatabaseError:
            logger.exception("DB error while fetching all municipalities with coastal flags")
            return Response({'error': 'Database temporarily unavailable.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            logger.exception("Unexpected error while fetching all municipalities with coastal flags")
            return Response({'error': 'Unexpected error occurred.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='sync-coastal-flags')
    def sync_coastal_flags(self, request):
        """Bulk-set is_coastal=True for municipalities that have water boundaries; False otherwise."""
        logger = logging.getLogger(__name__)
        try:
            with transaction.atomic():
                # Compute coastal municipality IDs based on boundary data
                coastal_ids = list(
                    MunicipalityBoundary.objects
                    .filter(municipality__isnull=False)
                    .filter(Q(coastline_length__gt=0) | Q(water_area__gt=0))
                    .values_list('municipality_id', flat=True)
                    .distinct()
                )

                # Reset all to False, then set True for computed set
                total = Municipality.objects.count()
                reset_count = Municipality.objects.update(is_coastal=False)
                updated_count = Municipality.objects.filter(municipality_id__in=coastal_ids).update(is_coastal=True)
            logger.info("sync_coastal_flags complete: total=%d, reset=%d, coastal_set=%d", total, reset_count, updated_count)
            return Response({
                'total': total,
                'reset_to_false': reset_count,
                'set_true': updated_count,
                'coastal_ids': coastal_ids,
            })
        except DatabaseError:
            logger.exception("DB error while syncing coastal flags")
            return Response({'error': 'Database temporarily unavailable.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            logger.exception("Unexpected error while syncing coastal flags")
            return Response({'error': 'Unexpected error occurred.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def add_barangays(self, request, pk=None):
        """Add multiple barangays to a municipality"""
        municipality = self.get_object()
        barangays_data = request.data.get('barangays', [])
        
        created_barangays = []
        errors = []
        
        for brgy_data in barangays_data:
            name = brgy_data.get('name', '').strip()
            if not name:
                continue
            
            # Check if barangay already exists
            if Barangay.objects.filter(name__iexact=name, municipality=municipality).exists():
                errors.append(f"Barangay '{name}' already exists in {municipality.name}")
                continue
            
            try:
                barangay = Barangay.objects.create(
                    name=name.title(),
                    municipality=municipality
                )
                created_barangays.append(BarangaySerializer(barangay).data)
            except Exception as e:
                errors.append(f"Error creating '{name}': {str(e)}")
        
        return Response({
            'created': created_barangays,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_barangays else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch'])
    def update_barangays(self, request, pk=None):
        """Update barangays for a municipality"""
        municipality = self.get_object()
        barangays_data = request.data.get('barangays', [])
        
        updated = []
        errors = []
        
        for brgy_data in barangays_data:
            barangay_id = brgy_data.get('barangay_id')
            if not barangay_id:
                continue
            
            try:
                barangay = Barangay.objects.get(barangay_id=barangay_id, municipality=municipality)
                barangay.name = brgy_data.get('name', barangay.name).strip().title()
                barangay.save()
                updated.append(BarangaySerializer(barangay).data)
            except Barangay.DoesNotExist:
                errors.append(f"Barangay ID {barangay_id} not found")
            except Exception as e:
                errors.append(f"Error updating barangay {barangay_id}: {str(e)}")
        
        return Response({
            'updated': updated,
            'errors': errors
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['delete'])
    def delete_barangays(self, request, pk=None):
        """Delete barangays from a municipality"""
        municipality = self.get_object()
        barangay_ids = request.data.get('barangay_ids', [])
        
        deleted = []
        errors = []
        
        for barangay_id in barangay_ids:
            try:
                barangay = Barangay.objects.get(barangay_id=barangay_id, municipality=municipality)
                name = barangay.name
                barangay.delete()
                deleted.append({'barangay_id': barangay_id, 'name': name})
            except Barangay.DoesNotExist:
                errors.append(f"Barangay ID {barangay_id} not found")
            except Exception as e:
                errors.append(f"Error deleting barangay {barangay_id}: {str(e)}")
        
        return Response({
            'deleted': deleted,
            'errors': errors
        }, status=status.HTTP_200_OK)


class BarangayViewSet(viewsets.ModelViewSet):
    queryset = Barangay.objects.all()
    serializer_class = BarangaySerializer
    # Admin full access; Provincial/Municipal Agriculturist read-only
    permission_classes = [IsAuthenticated, IsAdminOrAgriReadOnly]
    
    def get_queryset(self):
        queryset = Barangay.objects.all().select_related('municipality')
        
        # Filter by municipality
        municipality_id = self.request.query_params.get('municipality_id', None)
        if municipality_id:
            queryset = queryset.filter(municipality_id=municipality_id)
        
        # Search by name
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        return queryset.order_by('name')


class BarangayVerifierViewSet(viewsets.ModelViewSet):
    queryset = BarangayVerifier.objects.all()
    serializer_class = BarangayVerifierSerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgriReadOnly]
    
    def get_queryset(self):
        queryset = BarangayVerifier.objects.all().select_related('municipality', 'barangay')
        
        # Filter by municipality
        municipality_id = self.request.query_params.get('municipality_id', None)
        if municipality_id:
            queryset = queryset.filter(municipality_id=municipality_id)
        
        # Filter by barangay
        barangay_id = self.request.query_params.get('barangay_id', None)
        if barangay_id:
            queryset = queryset.filter(barangay_id=barangay_id)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('municipality__name', 'barangay__name', 'position')
    
    @action(detail=False, methods=['get'], url_path='assigned-positions')
    def assigned_positions(self, request):
        """Get list of positions already assigned for a specific barangay"""
        municipality_id = request.query_params.get('municipality_id')
        barangay_id = request.query_params.get('barangay_id')
        
        if not municipality_id or not barangay_id:
            return Response({'error': 'municipality_id and barangay_id are required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        assigned = BarangayVerifier.objects.filter(
            municipality_id=municipality_id,
            barangay_id=barangay_id,
            is_active=True,
        ).values_list('position', flat=True)
        
        return Response({'assigned_positions': list(assigned)})


class SignatoryViewSet(viewsets.ModelViewSet):
    queryset = Signatory.objects.all()
    serializer_class = SignatorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrAgriReadOnly]
    
    def get_queryset(self):
        queryset = Signatory.objects.all().select_related('municipality', 'barangay')
        
        # Filter by municipality
        municipality_id = self.request.query_params.get('municipality_id', None)
        if municipality_id:
            queryset = queryset.filter(municipality_id=municipality_id)
        
        # Filter by barangay
        barangay_id = self.request.query_params.get('barangay_id', None)
        if barangay_id:
            queryset = queryset.filter(barangay_id=barangay_id)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('municipality__name', 'barangay__name', 'position')
    
    @action(detail=False, methods=['get'], url_path='assigned-positions')
    def assigned_positions(self, request):
        """Get list of positions already assigned for a specific barangay"""
        municipality_id = request.query_params.get('municipality_id')
        barangay_id = request.query_params.get('barangay_id')
        
        if not municipality_id or not barangay_id:
            return Response({'error': 'municipality_id and barangay_id are required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        assigned = Signatory.objects.filter(
            municipality_id=municipality_id,
            barangay_id=barangay_id,
        ).values_list('position', flat=True)
        assigned = set(assigned)
        municipal_positions = ['Municipal Agriculturist', 'Municipal Fishery Coordinator', 'Mayor']
        muni_assigned = Signatory.objects.filter(
            municipality_id=municipality_id,
            position__in=municipal_positions
        ).values_list('position', flat=True)
        assigned.update(muni_assigned)
        if Signatory.objects.filter(position='Provincial Agriculturist').exists():
            assigned.add('Provincial Agriculturist')
        
        return Response({'assigned_positions': list(assigned)})


# Tracker History API View
@api_view(['GET'])
@permission_classes([AllowAny])
def tracker_history(request, tracker_id):
    """
    Timeline for a tracker or MFBR:
    - Works with BirukBilugID (preferred), tracker_id in GpsData, or MFBR number.
    - Events: registration, status (online/offline/reconnecting), boundary crossings,
      violations, and idle.
    """
    from .models import BirukbilugTracker, GpsData, BoundaryCrossing, BoundaryViolationNotification, DeviceToken, Boat
    from datetime import datetime, timedelta
    from django.db.models import Q
    try:
        # Normalize identifier
        ident = (tracker_id or '').strip()
        tracker = None
        boat = None
        boat_id = None
        mfbr = None

        # Try resolve tracker
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID=ident)
            boat = getattr(tracker, 'boat', None)
            boat_id = getattr(boat, 'boat_id', None)
            try:
                mfbr = getattr(boat, 'mfbr_number', None)
            except Exception:
                mfbr = None
        except BirukbilugTracker.DoesNotExist:
            tracker = None

        # If MFBR still unknown, infer from latest GPS by tracker_id
        if not mfbr:
            latest_with_tracker = GpsData.objects.filter(tracker_id=ident).order_by('-timestamp').first()
            if latest_with_tracker and latest_with_tracker.mfbr_number:
                mfbr = latest_with_tracker.mfbr_number
                if not boat:
                    boat = Boat.objects.filter(mfbr_number=mfbr).first()
                    boat_id = getattr(boat, 'boat_id', None)

        # Get filter parameter
        filter_type = request.query_params.get('filter', 'all')

        # Build timeline events
        timeline_events = []

        # 1) Registration event (when tracker exists)
        if tracker and filter_type in ['all', 'status']:
            timeline_events.append({
                'id': f'reg_{tracker.BirukBilugID}',
                'event_type': 'registered',
                'title': 'Tracker Registered',
                'description': f'Tracker {tracker.BirukBilugID} was registered for {tracker.municipality}',
                'timestamp': tracker.date_added.isoformat() if tracker.date_added else None,
                'metadata': {'municipality': tracker.municipality}
            })

        # Build GPS queryset using any available identifiers
        gps_q = Q(tracker_id=ident)
        if boat_id is not None:
            gps_q |= Q(boat_id=boat_id)
        if mfbr:
            gps_q |= Q(mfbr_number=mfbr)
        gps_points = list(GpsData.objects.filter(gps_q).order_by('-timestamp')[:200])

        # Robust fallback: if no points with combined query but we know MFBR, try MFBR-only
        if not gps_points and mfbr:
            gps_points = list(GpsData.objects.filter(mfbr_number=mfbr).order_by('-timestamp')[:200])
        # Last resort: tracker_id-only
        if not gps_points and ident:
            gps_points = list(GpsData.objects.filter(tracker_id=ident).order_by('-timestamp')[:200])

        # 2) Status events from persisted TrackerStatusEvent records
        if filter_type in ['all', 'status']:
            from .models import TrackerStatusEvent
            
            # Build query for status events
            status_q = Q(tracker_id=ident)
            if mfbr:
                status_q |= Q(mfbr_number=mfbr)
            if boat_id is not None:
                status_q |= Q(boat_id=boat_id)
            
            # Get persisted status events (already filtered by state machine)
            status_events = list(TrackerStatusEvent.objects.filter(status_q).order_by('-timestamp')[:100])
            
            # Fallback: if no persisted events exist, compute from GPS points
            if not status_events and gps_points:
                reconnect_threshold = timedelta(minutes=3)
                offline_threshold = timedelta(minutes=10)
                previous_status = None
                now_ts = timezone.now()
                for i, point in enumerate(gps_points):
                    # Determine status:
                    # - For the newest point (i == 0), compare to NOW
                    # - For historical points, compare the gap to the next older point
                    if i == 0:
                        age = now_ts - point.timestamp
                        if age >= offline_threshold:
                            current_status = 'offline'
                        elif age >= reconnect_threshold:
                            current_status = 'reconnecting'
                        else:
                            current_status = 'online'
                    else:
                        gap = gps_points[i - 1].timestamp - point.timestamp  # list sorted desc
                        if gap >= offline_threshold:
                            current_status = 'offline'
                        elif gap >= reconnect_threshold:
                            current_status = 'reconnecting'
                        else:
                            current_status = 'online'

                    # Emit only when the status actually changes in time sequence
                    should_emit = current_status != previous_status
                    if should_emit:
                        event_title = {
                            'online': 'Tracker Online',
                            'offline': 'Tracker Offline',
                            'reconnecting': 'Tracker Reconnecting'
                        }.get(current_status, 'Status Change')
                        timeline_events.append({
                            'id': f'status_{point.id}',
                            'event_type': current_status,
                            'title': event_title,
                            'description': {
                                'online': 'Tracker came online and started transmitting data',
                                'offline': 'Tracker went offline (no data for 10+ minutes)',
                                'reconnecting': 'Tracker is attempting to reconnect (intermittent signal 3+ minutes)'
                            }.get(current_status, 'Status changed'),
                            'timestamp': point.timestamp.isoformat(),
                            'metadata': {
                                'location': {'lat': float(point.latitude), 'lng': float(point.longitude)}
                            }
                        })
                        previous_status = current_status
            else:
                # Use persisted events
                for event in status_events:
                    event_title_map = {
                        'online': 'Tracker Online',
                        'offline': 'Tracker Offline',
                        'reconnecting': 'Tracker Reconnecting',
                        'reconnected': 'Tracker Reconnected'
                    }
                    event_desc_map = {
                        'online': 'Tracker came online and started transmitting data',
                        'offline': 'Tracker went offline (no data for 10+ minutes)',
                        'reconnecting': 'Tracker is attempting to reconnect (intermittent signal 3+ minutes)',
                        'reconnected': 'Tracker reconnected successfully after being offline'
                    }
                    
                    timeline_events.append({
                        'id': f'status_{event.id}',
                        'event_type': event.status,
                        'title': event_title_map.get(event.status, 'Status Change'),
                        'description': event_desc_map.get(event.status, 'Status changed'),
                        'timestamp': event.timestamp.isoformat(),
                        'metadata': {
                            'location': {'lat': float(event.latitude) if event.latitude else None, 'lng': float(event.longitude) if event.longitude else None},
                            'session_start': event.session_start.isoformat() if event.session_start else None,
                            'previous_status': event.previous_status
                        }
                    })

        # 3) Boundary crossings
        if filter_type in ['all', 'movements']:
            # Prefer persisted crossings if we have concrete boat_id
            persisted_crossings = []
            if boat_id:
                persisted_crossings = list(
                    BoundaryCrossing.objects.filter(boat_id=boat_id).order_by('-crossing_timestamp')[:50]
                )
            if persisted_crossings:
                for crossing in persisted_crossings:
                    crossing_time = crossing.crossing_timestamp
                    time_str = crossing_time.strftime('%I:%M %p') if crossing_time else 'Unknown time'
                    timeline_events.append({
                        'id': f'crossing_{crossing.id}',
                        'event_type': 'boundary_crossing',
                        'title': f'Location Update: {crossing.to_municipality}',
                        'description': f'Boat moved from {crossing.from_municipality} to {crossing.to_municipality} at {time_str}.',
                        'timestamp': crossing.crossing_timestamp.isoformat(),
                        'metadata': {
                            'from_municipality': crossing.from_municipality,
                            'to_municipality': crossing.to_municipality,
                            'location': {'lat': float(crossing.to_lat), 'lng': float(crossing.to_lng)},
                            'sms_sent': crossing.sms_sent,
                            'time_of_day': time_str
                        }
                    })
            else:
                # Derive crossings from GPS points by municipality changes (works even when boat_id is 0)
                try:
                    from .boundary_service import boundary_service
                    points = list(reversed(gps_points))  # chronological
                    prev_muni = None
                    prev_lat = None
                    prev_lng = None
                    for p in points:
                        muni = boundary_service.get_municipality_at_point(p.latitude, p.longitude)
                        if prev_muni is not None and muni and muni != prev_muni:
                            timeline_events.append({
                                'id': f'crossing_derived_{p.id}',
                                'event_type': 'boundary_crossing',
                                'title': f'Location Update: {muni}',
                                'description': f'Boat moved from {prev_muni} to {muni}.',
                                'timestamp': p.timestamp.isoformat(),
                                'metadata': {
                                    'from_municipality': prev_muni,
                                    'to_municipality': muni,
                                    'location': {'lat': float(p.latitude), 'lng': float(p.longitude)}
                                }
                            })
                        prev_muni = muni
                        prev_lat = p.latitude
                        prev_lng = p.longitude
                except Exception as e:
                    logger.warning(f"Failed to derive crossings for {ident}: {e}")

        # 4) Violations (support by boat link OR MFBR string)
        if filter_type in ['all', 'violations']:
            v_q = Q()
            if boat:
                v_q |= Q(boat=boat)
            if mfbr:
                v_q |= Q(mfbr_number=mfbr)
            if v_q:
                violations = BoundaryViolationNotification.objects.filter(v_q).order_by('-created_at')[:30]
                for violation in violations:
                    duration_mins = violation.dwell_duration // 60 if violation.dwell_duration else 0
                    duration_hours = duration_mins // 60
                    remaining_mins = duration_mins % 60
                    duration_str = f'{duration_hours}h {remaining_mins}m' if duration_hours > 0 else f'{duration_mins} minutes'
                    violation_time = violation.violation_timestamp if violation.violation_timestamp else violation.created_at
                    time_str = violation_time.strftime('%I:%M %p') if violation_time else 'Unknown time'
                    timeline_events.append({
                        'id': f'violation_{violation.id}',
                        'event_type': 'violation',
                        'title': '⚠️ Boundary Violation Detected',
                        'description': f'Unauthorized operation detected at {time_str}. The vessel remained in {violation.to_municipality} for {duration_str}, outside its registered municipality ({violation.from_municipality}).',
                        'timestamp': violation_time.isoformat(),
                        'metadata': {
                            'from_municipality': violation.from_municipality,
                            'to_municipality': violation.to_municipality,
                            'duration': duration_str,
                            'duration_minutes': duration_mins,
                            'location': {'lat': float(violation.current_lat), 'lng': float(violation.current_lng)},
                            'status': violation.status,
                            'time_of_day': time_str,
                            'severity': 'high' if duration_mins > 60 else 'medium'
                        }
                    })

        # Sort timeline by timestamp (newest first) using robust, TZ-safe parsing
        from django.utils.dateparse import parse_datetime
        from django.utils import timezone as dj_tz

        def _ts_key(ev):
            """
            Return a numeric timestamp (seconds since epoch) for safe comparison.
            Handles both offset-aware and naive datetimes by converting everything
            to naive in the current timezone.
            """
            ts = ev.get('timestamp')
            if not ts:
                return 0.0
            try:
                dt = parse_datetime(ts)
                if dt is None:
                    return 0.0
                # Normalize to naive in current timezone to avoid aware/naive comparisons
                if dj_tz.is_aware(dt):
                    dt = dj_tz.make_naive(dt, dj_tz.get_current_timezone())
                return dt.timestamp()
            except Exception:
                return 0.0

        timeline_events.sort(key=_ts_key, reverse=True)
        return Response(timeline_events, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"tracker_history failed: {e}")
        return Response({'error': 'Internal error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def provisioning_status(request, tracker_id):
    """
    Simple endpoint to check provisioning status of a tracker
    """
    try:
        from .models import BirukbilugTracker
        tracker = BirukbilugTracker.objects.get(BirukBilugID=tracker_id)
        
        # Get device token info
        device_token_info = None
        if hasattr(tracker, 'device_token') and tracker.device_token:
            device_token_info = {
                'token': tracker.device_token.token,
                'last_seen': tracker.device_token.last_seen_at.isoformat() if tracker.device_token.last_seen_at else None,
                'is_active': tracker.device_token.is_active
            }
        
        return Response({
            'tracker_id': tracker.BirukBilugID,
            'municipality': tracker.municipality,
            'status': tracker.status,
            'provisional': tracker.provisional,
            'date_added': tracker.date_added.isoformat() if tracker.date_added else None,
            'device_token': device_token_info,
            'provisioning_instructions': {
                'step1': f'Send: DEVICE_ID={tracker.BirukBilugID}',
                'step2': f'Send: TOKEN={tracker.device_token.token if device_token_info else "(no token generated)"}',
                'step3': 'Send: PROVISION',
                'note': 'Host, port, and path use defaults automatically'
            } if tracker.provisional else None
        }, status=status.HTTP_200_OK)
        
    except BirukbilugTracker.DoesNotExist:
        return Response(
            {'error': 'Tracker not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to get status: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        print(f"Error in tracker_history: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'An error occurred: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )