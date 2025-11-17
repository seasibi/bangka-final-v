from django.urls import path, include  # Include is imported here
from .views import (gps_data, gps_geojson, login_view, logout_view, refresh_token_view, protected_view,
                    get_users, create_user, update_user, change_password, set_new_password, check_email, check_registration_number,
                    request_password_reset, reset_password_confirm, ingest_positions, deactivate_current_admin, tracker_history)
from .test_beep_endpoint import test_beep_for_mfbr
from rest_framework.routers import DefaultRouter
from .views import BoatViewSet, FisherfolkViewSet, ProvincialAgriculturistViewSet, MunicipalAgriculturistViewSet, AddressViewSet, HouseholdViewSet, OrganizationViewSet, ContactsViewSet, ActivityLogViewSet, FisherfolkBoatViewSet, BirukbilugTrackerViewSet, DeviceTokenViewSet, MunicipalityViewSet, BarangayViewSet, BarangayVerifierViewSet, SignatoryViewSet
from .views import BoatMeasurementsViewSet, BoatGearAssignmentViewSet, BoatGearTypeAssignmentViewSet, BoatGearSubtypeAssignmentViewSet, GearTypeViewSet, GearSubtypeViewSet, ImportFisherfolkExcelView, ImportBoatExcelView, MunicipalityBoundaryViewSet, LandBoundaryViewSet
from .notification_views import BoundaryViolationNotificationViewSet
from .backup_views import create_backup, restore_backup, backup_history
from . import views_notification_enhancements as notif_views


router = DefaultRouter()
router.register(r'boats', BoatViewSet)
router.register(r'fisherfolk', FisherfolkViewSet, basename='fisherfolk')
router.register(r'fisherfolkboat', FisherfolkBoatViewSet, basename='fisherfolkboat')
router.register(r'provincial-agriculturists', ProvincialAgriculturistViewSet, basename='provincial-agriculturist')
router.register(r'municipal-agriculturists', MunicipalAgriculturistViewSet, basename='municipal-agriculturist')
router.register(r'activitylog', ActivityLogViewSet, basename='activitylog')
router.register(r'addresses', AddressViewSet, basename='address')
router.register(r'households', HouseholdViewSet, basename='household')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'contacts', ContactsViewSet, basename='contacts')
router.register(r'boat-measurements', BoatMeasurementsViewSet)
router.register(r'boat-gear-assignment', BoatGearAssignmentViewSet)
router.register(r'boat-gear-type-assignment', BoatGearTypeAssignmentViewSet)
router.register(r'boat-gear-subtype-assignment', BoatGearSubtypeAssignmentViewSet)
router.register(r'gear-types', GearTypeViewSet, basename='gear-type')
router.register(r'gear-subtypes', GearSubtypeViewSet, basename='gear-subtype')
router.register(r'birukbilug', BirukbilugTrackerViewSet, basename='birukbilug')
router.register(r'device-tokens', DeviceTokenViewSet, basename='device-token')
router.register(r'boundaries', MunicipalityBoundaryViewSet, basename='boundary')
router.register(r'land-boundaries', LandBoundaryViewSet, basename='land-boundary')
router.register(r'boundary-notifications', BoundaryViolationNotificationViewSet, basename='boundary-notification')
router.register(r'municipalities', MunicipalityViewSet, basename='municipality')
router.register(r'barangays', BarangayViewSet, basename='barangay')
router.register(r'barangay-verifiers', BarangayVerifierViewSet, basename='barangay-verifier')
router.register(r'signatories', SignatoryViewSet, basename='signatory')

urlpatterns = [
    path('users/', get_users, name='get_users'),
    path('users/create/', create_user, name='create_user'),
    path('users/update/<int:pk>/', update_user, name='update_user'),
    path('users/check-email/', check_email, name='check_email'),
    path('users/deactivate-current-admin/', deactivate_current_admin, name='deactivate_current_admin'),
    path('fisherfolk/check-registration-number/', check_registration_number, name='check_registration_number'),

    # TOKEN
    path('login/', login_view),
    path('logout/', logout_view),
    path('refresh/', refresh_token_view),
    path('protected/', protected_view),
    path('change-password/', change_password),
    path('set-new-password/', set_new_password),
    
    # Password Reset
    path('password-reset/', request_password_reset),
    path('password-reset-confirm/<str:uidb64>/<str:token>/', reset_password_confirm),
    
    # Import fisherfolk from Excel
    path('fisherfolk/import-excel/', ImportFisherfolkExcelView.as_view(), name='import_fisherfolk_excel'),
    
    # Import boats from Excel
    path('boats/import-excel/', ImportBoatExcelView.as_view(), name='import_boat_excel'),

    # Import boats from Excel
    path('boats/import-excel/', ImportBoatExcelView.as_view(), name='import_boats_excel'),

    path('', include(router.urls)),

     path('gps/', gps_data),

    path("gps/geojson/", gps_geojson),

    # Token-based ingest for devices (accept with and without trailing slash to avoid 307 redirects)
    path('ingest/v1/positions', ingest_positions),
    path('ingest/v1/positions/', ingest_positions),
    
    # Test endpoint for debugging beep flag
    path('test/beep/<str:mfbr>/', test_beep_for_mfbr),

    # Tracker history timeline
    path('tracker-history/<str:tracker_id>/', tracker_history, name='tracker_history'),

    # Import boats from Excel
    
    # Backup and Restore endpoints
    path('backup/create/', create_backup, name='create_backup'),
    path('backup/restore/', restore_backup, name='restore_backup'),
    path('backup/history/', backup_history, name='backup_history'),
    
    # Enhanced Notification System endpoints
    path('boundary-notifications/<int:violation_id>/update-status/', 
         notif_views.update_violation_status, 
         name='update-violation-status'),
    path('boundary-notifications/<int:violation_id>/audit-log/', 
         notif_views.get_violation_audit_log, 
         name='violation-audit-log'),
    path('boundary-notifications/<int:violation_id>/generate-pdf/', 
         notif_views.generate_violation_pdf, 
         name='generate-violation-pdf'),
]
