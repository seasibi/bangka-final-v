from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # Debug logging disabled to reduce console spam
        # print(f"\n=== CookieJWTAuthentication DEBUG ===")
        # print(f"Request path: {request.path}")
        # print(f"Request method: {request.method}")
        # print(f"All cookies: {request.COOKIES}")
        
        # Skip authentication for login/logout endpoints
        if request.path in ['/api/login/', '/api/logout/', '/api/refresh/']:
            # print("Skipping auth for login/logout/refresh endpoint")
            return None
            
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        # print(f"Looking for cookie named: {cookie_name}")
        
        raw_token = request.COOKIES.get(cookie_name)
        # print(f"Token from cookie: {raw_token[:20] if raw_token else 'None'}...")

        if raw_token is None:
            # print("No token found in cookies")
            return None
        
        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            # print(f"Authentication successful for user: {user.email}")
            return user, validated_token
        except TokenError as e:
            # print(f"Token validation error: {e}")
            # If token is invalid, return None instead of raising exception
            # This allows the request to continue to views that use AllowAny permission
            return None
