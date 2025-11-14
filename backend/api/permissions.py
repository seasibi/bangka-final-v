from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsAdminOrProvincialOrMunicipal(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.user_role in ['admin', 'provincial_agriculturist', 'municipal_agriculturist']
        )

class IsAdminOrProvincialOrAgriculturistReadOnly(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False
        # Admin: full access
        if user.user_role == 'admin':
            return True
        # Allow read-only for provincial or municipal agriculturists
        if request.method in SAFE_METHODS and user.user_role in ('provincial_agriculturist', 'municipal_agriculturist'):
            return True
        return False

class IsAdminOrAgriReadOnly(BasePermission):
    """Admin has full access. Provincial/Municipal Agriculturist have read-only (SAFE_METHODS)."""
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False
        if user.user_role == 'admin':
            return True
        return request.method in SAFE_METHODS and user.user_role in ('provincial_agriculturist', 'municipal_agriculturist')

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.user_role == 'admin'

class IsStaffOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.user_role in ['admin', 'provincial_agriculturist', 'municipal_agriculturist'])

class IsSelfOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user.user_role == 'admin' or obj == request.user