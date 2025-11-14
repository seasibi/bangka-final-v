from django.contrib import admin
from .models import User, Boat, Fisherfolk, MunicipalAgriculturist, ProvincialAgriculturist, AdminProfile, BoundaryCrossing, Municipality, Barangay, BarangayVerifier, Signatory
from .forms import UserCreationForm, UserChangeForm
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User
    list_display = ('email', 'user_role', 'is_staff', 'is_active')
    list_filter = ('user_role', 'is_staff', 'is_active')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Permissions', {'fields': ('user_role', 'is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'user_role', 'password1', 'password2', 'is_staff', 'is_active')}
        ),
    )
    search_fields = ('email',)
    ordering = ('email',)

@admin.register(Boat)
class BoatAdmin(admin.ModelAdmin):
    list_display = ('mfbr_number', 'boat_name', 'boat_type', 'material_used')
    list_filter = ('boat_type', 'material_used')
    search_fields = ('mfbr_number', 'boat_name')
    ordering = ('-date_added',)

@admin.register(Fisherfolk)
class FisherfolkAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'last_name', 'first_name')
    search_fields = ('registration_number', 'last_name', 'first_name')
    ordering = ('-date_added',)

@admin.register(MunicipalAgriculturist)
class MunicipalAgriculturistAdmin(admin.ModelAdmin):
    list_display = ('municipal_agriculturist_id', 'first_name', 'last_name', 'municipality', 'position', 'status')
    list_filter = ('municipality', 'position', 'status')
    search_fields = ('first_name', 'last_name', 'municipality')
    ordering = ('-date_added',)

@admin.register(ProvincialAgriculturist)
class ProvincialAgriculturistAdmin(admin.ModelAdmin):
    list_display = ('provincial_agriculturist_id', 'first_name', 'last_name', 'position', 'status')
    list_filter = ('position', 'status')
    search_fields = ('first_name', 'last_name')
    ordering = ('-date_added',)

@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('admin_id', 'first_name', 'last_name', 'position', 'status')
    list_filter = ('position', 'status')
    search_fields = ('first_name', 'last_name')
    ordering = ('-date_added',)

@admin.register(BoundaryCrossing)
class BoundaryCrossingAdmin(admin.ModelAdmin):
    list_display = (
        'boat_id', 'fisherfolk', 'from_municipality', 'to_municipality', 
        'crossing_timestamp', 'sms_sent', 'phone_number'
    )
    list_filter = (
        'sms_sent', 'from_municipality', 'to_municipality', 'crossing_timestamp'
    )
    search_fields = (
        'boat_id', 'fisherfolk__first_name', 'fisherfolk__last_name', 
        'phone_number', 'from_municipality', 'to_municipality'
    )
    readonly_fields = (
        'crossing_timestamp', 'from_lat', 'from_lng', 'to_lat', 'to_lng', 
        'sms_response'
    )
    ordering = ('-crossing_timestamp',)
    
    fieldsets = (
        ('Crossing Details', {
            'fields': (
                'boat_id', 'fisherfolk', 'from_municipality', 'to_municipality',
                'crossing_timestamp'
            )
        }),
        ('GPS Coordinates', {
            'fields': (
                ('from_lat', 'from_lng'), 
                ('to_lat', 'to_lng')
            )
        }),
        ('SMS Notification', {
            'fields': (
                'phone_number', 'sms_sent', 'sms_response'
            )
        }),
    )
    
    def has_add_permission(self, request):
        # Prevent manual creation - crossings should be auto-generated
        return False

@admin.register(Municipality)
class MunicipalityAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'is_active', 'barangay_count', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name',)
    ordering = ('name',)
    
    def barangay_count(self, obj):
        return obj.barangays.count()
    barangay_count.short_description = 'Barangays'

@admin.register(Barangay)
class BarangayAdmin(admin.ModelAdmin):
    list_display = ('name', 'municipality', 'created_at')
    list_filter = ('municipality', 'created_at')
    search_fields = ('name', 'municipality__name')
    ordering = ('municipality__name', 'name')

@admin.register(BarangayVerifier)
class BarangayVerifierAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'position', 'barangay', 'municipality', 'is_active', 'created_at')
    list_filter = ('is_active', 'position', 'municipality', 'created_at')
    search_fields = ('first_name', 'last_name', 'barangay__name', 'municipality__name')
    ordering = ('municipality__name', 'barangay__name', 'position')
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
    get_full_name.short_description = 'Full Name'

@admin.register(Signatory)
class SignatoryAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'position', 'barangay', 'municipality', 'is_active', 'created_at')
    list_filter = ('is_active', 'position', 'municipality', 'created_at')
    search_fields = ('first_name', 'last_name', 'barangay__name', 'municipality__name')
    ordering = ('municipality__name', 'barangay__name', 'position')
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
    get_full_name.short_description = 'Full Name'

admin.site.register(User, UserAdmin)
