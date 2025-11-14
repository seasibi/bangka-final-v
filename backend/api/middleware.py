from django.utils.deprecation import MiddlewareMixin

class DisableCSRFForAPIMiddleware(MiddlewareMixin):
    """
    Middleware to disable CSRF for API endpoints.
    This is safe for API endpoints that use JWT authentication.
    """
    def process_view(self, request, view_func, view_args, view_kwargs):
        # Disable CSRF for any request to /api/
        if request.path.startswith('/api/'):
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None
