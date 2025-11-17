
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.core.exceptions import ValidationError
from django.utils.timezone import now
import random
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F, Q
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
from multiselectfield import MultiSelectField
import os
import secrets
from django.db.models.signals import post_save
from django.dispatch import receiver

# Device token generator

def generate_device_token():
    return secrets.token_hex(32)

# USER MANAGER
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('user_role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)

# Municipal Agriculturist Model
class MunicipalAgriculturist(models.Model):
    municipal_agriculturist_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    sex = models.CharField(max_length=10)
    municipality = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=20)
    position = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='Active')
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

# Provincial Agriculturist Model
class ProvincialAgriculturist(models.Model):
    provincial_agriculturist_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    sex = models.CharField(max_length=10)
    contact_number = models.CharField(max_length=20)
    position = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='Active')
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

# Admin Profile Model
class AdminProfile(models.Model):
    admin_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    sex = models.CharField(max_length=10)
    contact_number = models.CharField(max_length=20)
    position = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='Active')
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

# USER MODEL
class User(AbstractBaseUser, PermissionsMixin):
    USER_ROLES = (
        ('admin', 'Admin'),
        ('provincial_agriculturist', 'Provincial Agriculturist'),
        ('municipal_agriculturist', 'Municipal Agriculturist'),
    )

    GENDER_CHOICES = (
        ('male', 'Male'),
        ('female', 'Female'),
    )

    id = models.AutoField(primary_key=True)
    municipal_agriculturist = models.ForeignKey(MunicipalAgriculturist, on_delete=models.SET_NULL, null=True, blank=True)
    provincial_agriculturist = models.ForeignKey(ProvincialAgriculturist, on_delete=models.SET_NULL, null=True, blank=True)
    admin_profile = models.ForeignKey(AdminProfile, on_delete=models.SET_NULL, null=True, blank=True)
    password = models.CharField(max_length=128)
    email = models.EmailField(
        unique=True,
        error_messages={
            'unique': 'A user with this email address already exists.',
        }
    )
    sex = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)
    is_superuser = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    user_role = models.CharField(max_length=30, choices=USER_ROLES)
    is_active = models.BooleanField(default=True)
    must_change_password = models.BooleanField(default=False)
    date_added = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['user_role']

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['email'],
                name='unique_email_case_insensitive',
                condition=models.Q(is_active=True)
            )
        ]

    def clean(self):
        super().clean()
        # Convert email to lowercase before saving
        if self.email:
            self.email = self.email.lower()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


# Ensure only one admin (superuser or role='admin') remains active at any time
@receiver(post_save, sender=User)
def _ensure_single_active_admin(sender, instance, created, **kwargs):
    try:
        if instance.is_active and (instance.is_superuser or instance.user_role == 'admin'):
            # Deactivate all other active admins
            sender.objects.filter(is_active=True).filter(
                models.Q(is_superuser=True) | models.Q(user_role='admin')
            ).exclude(pk=instance.pk).update(is_active=False)
    except Exception:
        pass

class Fisherfolk(models.Model):
    SALUTATION_CHOICES = [
        ('Mr', 'Mr'),
        ('Ms', 'Ms'),
        ('Mrs', 'Mrs'),
    ]
    RELIGION_CHOICES = [
    ('Roman Catholic', 'Roman Catholic'),
    ('Protestant Christian', 'Protestant Christian'),
    ('Iglesia Ni Cristo', 'Iglesia Ni Cristo'),
    ('Aglipayan', 'Aglipayan'),
    ('Islam', 'Islam'),
    ('Evangelical', 'Evangelical'),
    ('Seventh-Day Adventist', 'Seventh-Day Adventist'),
    ('Jehovah\'S Witnesses', 'Jehovah\'S Witnesses'),
    ('Buddhist', 'Buddhist'),
    ('Hindu', 'Hindu'),
    ('No Religion', 'No Religion'),
    ('Others', 'Others'),
    ]
    EDUCATIONAL_BACKGROUND_CHOICES = [
        ('Elementary', 'Elementary'),
        ('High School', 'High School'),
        ('Vocational', 'Vocational'),
        ('College', 'College'),
        ('Post Graduate', 'Post Graduate'),
        ('Others', 'Others'),
    ]
    LIVELIHOOD_CHOICES = [
        ('Capture Fishing', 'Capture Fishing'),
        ('Aquaculture', 'Aquaculture'),
        ('Fish Vending', 'Fish Vending'),
        ('Gleaning', 'Gleaning'),
        ('Fish Processing', 'Fish Processing'),
        ('Others', 'Others'),
    ]

    registration_number = models.CharField(max_length=50, primary_key=True)
    salutations = models.CharField(max_length=5, choices=SALUTATION_CHOICES, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    appelation = models.CharField(max_length=20, blank=True, null=True)
    birth_date = models.DateField()
    age = models.PositiveIntegerField(blank=True, null=True)
    birth_place = models.CharField(max_length=200)
    civil_status = models.CharField(max_length=20)
    sex = models.CharField(max_length=10, choices=[('Male', 'Male'), ('Female', 'Female')])
    contact_number = models.CharField(max_length=20)
    nationality = models.CharField(max_length=100)
    fisherfolk_status = models.CharField(max_length=50, blank=True, null=True)
    mothers_maidenname = models.CharField(max_length=100, blank=True, null=True)
    fishing_ground = models.CharField(max_length=100, blank=True, null=True)
    fma_number = models.CharField(max_length=50, blank=True, null=True)
    religion = models.CharField(max_length=30, choices=RELIGION_CHOICES, blank=True, null=True)
    educational_background = models.CharField(max_length=20, choices=EDUCATIONAL_BACKGROUND_CHOICES, blank=True, null=True)
    household_month_income = models.CharField(max_length=100, blank=True, null=True)
    other_source_income = models.CharField(max_length=100, blank=True, null=True)
    # Free-text when main_source_livelihood is "Others"
    other_main_source_livelihood = models.CharField(max_length=100, blank=True, null=True)
    farming_income = models.BooleanField(default=False)
    farming_income_salary = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    fisheries_income = models.BooleanField(default=False)
    fisheries_income_salary = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    with_voterID = models.BooleanField(default=False)
    voterID_number = models.CharField(max_length=50, blank=True, null=True)
    is_CCT_4ps = models.BooleanField(default=False)
    is_ICC = models.BooleanField(default=False)
    main_source_livelihood = models.CharField(max_length=30, choices=LIVELIHOOD_CHOICES, blank=True, null=True)
    other_source_livelihood = MultiSelectField(
        choices=LIVELIHOOD_CHOICES,
        blank=True,
        null=True,
    )
    fisherfolk_img = models.ImageField(upload_to='fisherfolk_pictures/', blank=True, null=True)
    date_added = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_fisherfolk')


    def save(self, *args, **kwargs):
        # Title Case for all string fields except password/email
        for field in self._meta.fields:
            value = getattr(self, field.name)
            if value is not None and isinstance(value, str):
                if field.name not in ["password", "email"]:
                    setattr(self, field.name, value.title())
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.registration_number} - {self.last_name}, {self.first_name}"

# Address model for Fisherfolk
class Address(models.Model):
    def save(self, *args, **kwargs):
        # Title Case for all string fields except password/email
        for field in self._meta.fields:
            value = getattr(self, field.name)
            if value is not None and isinstance(value, str):
                if field.name not in ["password", "email"]:
                    setattr(self, field.name, value.title())
        super().save(*args, **kwargs)
    address_log = models.AutoField(primary_key=True)
    fisherfolk = models.OneToOneField('Fisherfolk', on_delete=models.CASCADE, related_name='address')
    MUNICIPALITY_CHOICES = [
        ("Agoo", "Agoo"),
        ("Aringay", "Aringay"),
        ("Bacnotan", "Bacnotan"),
        ("Bagulin", "Bagulin"),
        ("Balaoan", "Balaoan"),
        ("Bangar", "Bangar"),
        ("Bauang", "Bauang"),
        ("Burgos", "Burgos"),
        ("Caba", "Caba"),
        ("Luna", "Luna"),
        ("Naguilian", "Naguilian"),
        ("Pugo", "Pugo"),
        ("Rosario", "Rosario"),
        ("San Fernando", "San Fernando"),
        ("San Gabriel", "San Gabriel"),
        ("San Juan", "San Juan"),
        ("Santol", "Santol"),
        ("Santo Tomas", "Santo Tomas"),
        ("Sudipen", "Sudipen"),
        ("Tubao", "Tubao"),
    ]
    street = models.CharField(max_length=255)
    # Barangay choices should be enforced dynamically in forms/serializers based on the selected municipality
    barangay = models.CharField(max_length=100)
    municipality = models.CharField(max_length=100, choices=MUNICIPALITY_CHOICES)
    province = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    residency_years = models.PositiveIntegerField()
    barangay_verifier = models.CharField(max_length=100)
    position = models.CharField(max_length=100)
    verified_date = models.DateField(blank=True, null=True)
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.fisherfolk.registration_number} - {self.barangay}, {self.municipality}"


# Household model for Fisherfolk
class Household(models.Model):
    household_number = models.AutoField(primary_key=True)
    fisherfolk = models.OneToOneField('Fisherfolk', on_delete=models.CASCADE, related_name='household')
    total_no_household_memb = models.PositiveIntegerField()
    no_male = models.PositiveIntegerField()
    no_female = models.PositiveIntegerField()
    no_children = models.PositiveIntegerField()
    no_in_school = models.PositiveIntegerField()
    no_out_school = models.PositiveIntegerField()
    no_employed = models.PositiveIntegerField()
    no_unemployed = models.PositiveIntegerField()
    date_added = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Title Case for all string fields except password/email
        for field in self._meta.fields:
            value = getattr(self, field.name)
            if value is not None and isinstance(value, str):
                if field.name not in ["password", "email"]:
                    setattr(self, field.name, value.title())
        super().save(*args, **kwargs)
    def __str__(self):
        return f"{self.fisherfolk.registration_number} - Household {self.household_number}"


# Organization model for Fisherfolk
class Organization(models.Model):
    org_id = models.AutoField(primary_key=True)
    fisherfolk = models.ForeignKey('Fisherfolk', on_delete=models.CASCADE, related_name='organizations')
    org_name = models.CharField(max_length=255, null=True)
    member_since = models.DateField(null=True, blank=True)
    org_position = models.CharField(max_length=100, null=True)
    date_added = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Title Case for all string fields except password/email
        for field in self._meta.fields:
            value = getattr(self, field.name)
            if value is not None and isinstance(value, str):
                if field.name not in ["password", "email"]:
                    setattr(self, field.name, value.title())
        super().save(*args, **kwargs)
    def __str__(self):
        return f"{self.fisherfolk.registration_number} - {self.org_name}"


# Contacts model for Fisherfolk
class Contacts(models.Model):
    contact_id = models.AutoField(primary_key=True)
    fisherfolk = models.OneToOneField('Fisherfolk', on_delete=models.CASCADE, related_name='contacts')
    contact_fname = models.CharField(max_length=100)
    contact_mname = models.CharField(max_length=100)
    contact_lname = models.CharField(max_length=100)
    contact_street = models.CharField(max_length=100, default='N/A')
    contact_relationship = models.CharField(max_length=100)
    contact_contactno = models.CharField(max_length=20)
    contact_municipality = models.CharField(max_length=255)
    contact_barangay = models.CharField(max_length=255)
    date_added = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Title Case for all string fields except password/email
        for field in self._meta.fields:
            value = getattr(self, field.name)
            if value is not None and isinstance(value, str):
                if field.name not in ["password", "email"]:
                    setattr(self, field.name, value.title())
        super().save(*args, **kwargs)
    def __str__(self):
        return f"{self.fisherfolk.registration_number} - {self.contact_fname} {self.contact_lname}"


# --- Gear Classification ---
class GearClassification(models.Model):
    name = models.CharField(max_length=20, choices=[('marine', 'Marine'), ('inland', 'Inland')], unique=True)
    def __str__(self):
        return self.name

# --- Gear Type (e.g., Surround Net, Cast Net) ---
class GearType(models.Model):
    classification = models.ForeignKey(GearClassification, on_delete=models.CASCADE, related_name='gear_types')
    name = models.CharField(max_length=100)
    def __str__(self):
        return f"{self.classification.name} - {self.name}"

# --- Gear Subtype (e.g., Ring Net under Surround Net) ---
class GearSubtype(models.Model):
    gear_type = models.ForeignKey(GearType, on_delete=models.CASCADE, related_name='subtypes')
    name = models.CharField(max_length=100)
    def __str__(self):
        return f"{self.gear_type.name} - {self.name}"


# Redesigned Boat model (1-to-1 with Fisherfolk)
class Boat(models.Model):

    REGISTRATION_TYPES=[
        ('New/Initial Registration', 'New/Initial Registration'),
        ('Issuance of New Certificate Number', 'Issuance of New Certificate Number'),
        ('Re-Issuance of Certificate Number', 'Re-Issuance of Certificate Number')
    ]

    OWNERSHIP_TYPES=[
        ('Individual', 'Individual'),
        ('Group', 'Group')
    ]

    BOAT_TYPES=[
        ('Non-Motorized', 'Non-Motorized'),
        ('Motorized', 'Motorized')
    ]

    MATERIAL_TYPES=[
        ('Wood', 'Wood'),
        ('Fiber Glass', 'Fiber Glass'),
        ('Composite', 'Composite')
    ]

    mfbr_number = models.CharField(max_length=50, primary_key=True)
    application_date = models.DateField()
    type_of_registration = models.CharField(max_length=100, choices=REGISTRATION_TYPES)
    fisherfolk_registration_number = models.ForeignKey(
    Fisherfolk,
    on_delete=models.CASCADE,
    related_name='boats'   # plural makes sense now
)
    type_of_ownership = models.CharField(max_length=100, choices=OWNERSHIP_TYPES)
    boat_name = models.CharField(max_length=100)
    boat_type = models.CharField(max_length=50, choices=BOAT_TYPES)
    fishing_ground = models.CharField(max_length=100)
    fma_number = models.CharField(max_length=50)
    built_place = models.CharField(max_length=100)
    no_fishers = models.IntegerField()
    material_used = models.CharField(max_length=100, choices=MATERIAL_TYPES)
    homeport = models.CharField(max_length=100)
    built_year = models.IntegerField()
    engine_make = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100)
    horsepower = models.CharField(max_length=50)
    registered_municipality = models.CharField(max_length=100, blank=True, null=True, help_text="Municipality where the boat is registered")
    is_active = models.BooleanField(default=True)
    date_added = models.DateTimeField(auto_now_add=True)
    boat_image = models.ImageField(upload_to="boats/", null=True, blank=True)

    def save(self, *args, **kwargs):
        # Auto-populate registered_municipality from fisherfolk's address if not set
        if not self.registered_municipality and self.fisherfolk_registration_number:
            try:
                fisherfolk = self.fisherfolk_registration_number
                if hasattr(fisherfolk, 'address') and fisherfolk.address:
                    if hasattr(fisherfolk.address, 'municipality') and fisherfolk.address.municipality:
                        self.registered_municipality = fisherfolk.address.municipality
            except Exception:
                pass  # Fail silently, municipality can be set manually later
        
        # Do not force is_active to True on every save; default=True handles creation.
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.mfbr_number} - {self.boat_name}"

# Boat Measurements (1-to-1 with Boat)
class BoatMeasurements(models.Model):
    boat_measure_id = models.AutoField(primary_key=True)
    boat = models.OneToOneField(Boat, on_delete=models.CASCADE, related_name='measurements')
    registered_length = models.DecimalField(max_digits=10, decimal_places=2)
    registered_breadth = models.DecimalField(max_digits=10, decimal_places=2)
    registered_depth = models.DecimalField(max_digits=10, decimal_places=2)
    tonnage_length = models.DecimalField(max_digits=10, decimal_places=2)
    tonnage_breadth = models.DecimalField(max_digits=10, decimal_places=2)
    tonnage_depth = models.DecimalField(max_digits=10, decimal_places=2)
    gross_tonnage = models.DecimalField(max_digits=10, decimal_places=2)
    net_tonnage = models.DecimalField(max_digits=10, decimal_places=2)
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Measurements for Boat {self.boat.mfbr_number}"

# --- Boat Gear Assignment (1-to-1 with Boat, root for all gear types) ---
class BoatGearAssignment(models.Model):
    boat = models.ForeignKey(Boat, on_delete=models.CASCADE)
    def __str__(self):
        return f"Gear assignment for {self.boat.boat_name}"

# --- Individual Gear Type Assignment (for each gear type, present/absent) ---
class BoatGearTypeAssignment(models.Model):
    boat_gear_assignment = models.ForeignKey(BoatGearAssignment, on_delete=models.CASCADE)
    gear_type = models.ForeignKey(GearType, on_delete=models.CASCADE)
    is_present = models.BooleanField(default=False)
    def __str__(self):
        return f"{self.boat_gear.boat.boat_name} - {self.gear_type.name}: {self.is_present}"

# --- Boat Gear Subtype Assignment (for each gear type, what subtypes and quantities) ---
class BoatGearSubtypeAssignment(models.Model):
    boat_gear_assignment = models.ForeignKey(BoatGearAssignment, on_delete=models.CASCADE)
    gear_subtype = models.ForeignKey(GearSubtype, on_delete=models.CASCADE)
    is_present = models.BooleanField(default=False)
    quantity = models.IntegerField(blank=True, null=True)
    def __str__(self):
        return f"{self.type_assignment.boat_gear.boat.boat_name} - {self.gear_subtype.name}: {self.quantity if self.is_present else 'None'}"


class BirukbilugTracker(models.Model):
    BirukBilugID = models.CharField(max_length=50, primary_key=True)  # Changed to CharField to match existing data
    municipality = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='available')
    date_added = models.DateTimeField(auto_now_add=True)
    provisional = models.BooleanField(default=False, help_text="Indicates tracker with incomplete provisioning")

    boat = models.OneToOneField(
        "Boat",
        on_delete=models.SET_NULL,   # delete tracker if boat is deleted
        related_name="tracker",
        null=True,
        blank=True
    )
    def __str__(self):
        return f"Tracker {self.BirukBilugID} - {self.municipality}"
    
class FisherfolkBoat(models.Model):
    boat_registry_no = models.AutoField(primary_key=True)
    registration_number = models.ForeignKey(Fisherfolk, on_delete=models.CASCADE)
    mfbr_number = models.ForeignKey(Boat, on_delete=models.CASCADE)
    
    type_of_ownership = models.CharField(max_length=50)
    
    no_of_fishers = models.IntegerField()
    homeport = models.CharField(max_length=100)
    date_added = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.boat_registry_no} - {self.registration_number.registration_number}"

    def save(self, *args, **kwargs):
        self.is_active = True  
        super().save(*args, **kwargs)

# class BoatBirukbilugTracker(models.Model):
#     TrackingNo = models.AutoField(primary_key=True)
#     BirukBilugID = models.ForeignKey(BirukbilugTracker, on_delete=models.CASCADE)
#     BoatRegistryNo = models.ForeignKey(FisherfolkBoat, on_delete=models.CASCADE)
#     Timestamp = models.DateTimeField(auto_now_add=True)
#     Longitude = models.DecimalField(max_digits=9, decimal_places=6)
#     Latitude = models.DecimalField(max_digits=9, decimal_places=6)

#     def __str__(self):
#         return f"Tracking {self.TrackingNo} - Boat {self.BoatRegistryNo.BoatRegistryNo}"

class MunicipalityBoundary(models.Model):
    name = models.CharField(max_length=100, unique=True)
    municipality = models.ForeignKey('Municipality', on_delete=models.CASCADE, related_name='water_boundaries', null=True, blank=True)
    water_area = models.DecimalField(max_digits=10, decimal_places=4)
    coastline_length = models.DecimalField(max_digits=10, decimal_places=4)
    coordinates = models.JSONField()  # stores GeoJSON polygon data

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # If linked to Municipality, keep name in sync
        try:
            if self.municipality and self.municipality.name:
                self.name = self.municipality.name
        except Exception:
            pass
        super().save(*args, **kwargs)

# Land boundaries model
class LandBoundary(models.Model):
    land_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    municipality = models.ForeignKey('Municipality', on_delete=models.CASCADE, related_name='land_boundaries', null=True, blank=True)
    land_area = models.DecimalField(max_digits=10, decimal_places=4)
    boundary_length = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    coordinates = models.JSONField()  # stores GeoJSON polygon data
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        # If linked to Municipality, keep name in sync
        try:
            if self.municipality and self.municipality.name:
                self.name = self.municipality.name
        except Exception:
            pass
        super().save(*args, **kwargs)
    
class ActivityLog(models.Model):
    logId = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    user_role = models.CharField(max_length=50, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.action} at {self.timestamp}"


# Gps data
class GpsData(models.Model):    
    latitude = models.FloatField()
    longitude = models.FloatField()
    boat_id = models.IntegerField()
    # Optional metadata for better mapping/linking
    mfbr_number = models.CharField(max_length=50, blank=True, null=True)
    tracker_id = models.CharField(max_length=50, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        ident = self.mfbr_number or self.boat_id
        return f"Boat {ident} @ {self.latitude},{self.longitude}"

# Per-device token for ingest (simple bearer tokens)
class DeviceToken(models.Model):
    name = models.CharField(max_length=100, blank=True)
    token = models.CharField(max_length=64, unique=True, default=generate_device_token)
    boat_id = models.IntegerField(null=True, blank=True)  # optional default boat id for this device
    tracker = models.OneToOneField(
        'BirukbilugTracker', on_delete=models.SET_NULL, null=True, blank=True, related_name='device_token'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["name"]),
            models.Index(fields=["-last_seen_at"]),
        ]

    def __str__(self):
        label = self.name or (self.tracker.BirukBilugID if self.tracker else None) or self.token[:8]
        return label
    
    @property
    def is_idle(self):
        """
        Determine if tracker is idle/anchored vs. moving.
        Returns True if device hasn't moved significantly in last 15 minutes.
        Threshold: < 50 meters total distance over 15 minutes = idle.
        """
        from django.utils.timezone import now
        from datetime import timedelta
        from math import radians, cos, sin, asin, sqrt
        
        cutoff = now() - timedelta(minutes=15)
        
        # Get recent positions for this device's boat_id or tracker
        positions = GpsData.objects.filter(
            timestamp__gte=cutoff
        )
        
        # Filter by boat_id if available
        if self.boat_id:
            positions = positions.filter(boat_id=self.boat_id)
        # Or by tracker name match
        elif self.tracker:
            positions = positions.filter(tracker_id=self.tracker.BirukBilugID)
        else:
            return False  # No link to positions
        
        positions = positions.order_by('timestamp')
        
        if positions.count() < 2:
            return False  # Not enough data
        
        # Calculate total distance using Haversine formula
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371000  # Earth radius in meters
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            return R * c
        
        total_distance = 0
        prev = None
        for pos in positions:
            if prev:
                dist = haversine(prev.latitude, prev.longitude, pos.latitude, pos.longitude)
                total_distance += dist
            prev = pos
        
        # Idle threshold: less than 50 meters over 15 minutes
        return total_distance < 50
    
    @property
    def has_active_violation(self):
        """
        Check if device has active boundary violation in last 30 minutes.
        Used to trigger red wave animation on map.
        """
        from django.utils.timezone import now
        from datetime import timedelta
        cutoff = now() - timedelta(minutes=30)
        return BoundaryViolationNotification.objects.filter(
            boat_id=self.boat_id,
            status='pending',
            created_at__gte=cutoff
        ).exists()


class BoundaryCrossing(models.Model):
    """Log of boundary crossings for audit trail and SMS notifications"""
    boat_id = models.IntegerField()
    fisherfolk = models.ForeignKey(Fisherfolk, on_delete=models.SET_NULL, null=True, blank=True)
    from_municipality = models.CharField(max_length=100)
    to_municipality = models.CharField(max_length=100)
    crossing_timestamp = models.DateTimeField(auto_now_add=True)
    from_lat = models.FloatField()
    from_lng = models.FloatField()
    to_lat = models.FloatField()
    to_lng = models.FloatField()
    sms_sent = models.BooleanField(default=False)
    sms_response = models.JSONField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=["boat_id", "-crossing_timestamp"]),
            models.Index(fields=["crossing_timestamp"]),
            models.Index(fields=["from_municipality", "to_municipality"]),
        ]
        
    def __str__(self):
        return f"Boat {self.boat_id}: {self.from_municipality} → {self.to_municipality} at {self.crossing_timestamp}"


class BoundaryViolationNotification(models.Model):
    """UI notifications for boundary violations (15+ minute dwell in wrong municipality)"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('read', 'Read'),
        ('dismissed', 'Dismissed'),
    ]
    
    boundary_crossing = models.ForeignKey(BoundaryCrossing, on_delete=models.CASCADE, related_name='notifications')
    boat = models.ForeignKey(Boat, on_delete=models.CASCADE, null=True, blank=True)
    fisherfolk = models.ForeignKey(Fisherfolk, on_delete=models.SET_NULL, null=True, blank=True)
    boat_name = models.CharField(max_length=100)  # Cached boat name
    mfbr_number = models.CharField(max_length=50, blank=True)  # Cached MFBR
    tracker_number = models.CharField(max_length=50, blank=True)  # Cached tracker ID
    from_municipality = models.CharField(max_length=100)
    to_municipality = models.CharField(max_length=100)
    violation_timestamp = models.DateTimeField()  # When 15 min threshold was exceeded
    current_lat = models.FloatField()
    current_lng = models.FloatField()
    dwell_duration = models.IntegerField(help_text="Duration in seconds")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    read_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='read_notifications')
    
    # Enhanced notification fields for status tracking and reporting
    REPORT_STATUS_CHOICES = [
        ('Not Reported', 'Not Reported'),
        ('Fisherfolk Reported', 'Fisherfolk Reported'),
        ('Under Investigation', 'Under Investigation'),
        ('Resolved', 'Resolved'),
    ]
    
    report_number = models.CharField(max_length=50, blank=True, null=True, help_text='Format: RPT-YYYY-NNNN')
    report_status = models.CharField(max_length=50, choices=REPORT_STATUS_CHOICES, default='Not Reported')
    remarks = models.TextField(blank=True, help_text='Official remarks about the violation')
    status_updated_at = models.DateTimeField(null=True, blank=True)
    status_updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_violations')
    timestamp_start = models.DateTimeField(null=True, blank=True, help_text='When boat started being idle')
    timestamp_end = models.DateTimeField(null=True, blank=True, help_text='When violation was detected')
    idle_minutes = models.IntegerField(default=0, help_text='Duration boat was idle in minutes')
    contact_person_name = models.CharField(max_length=100, blank=True)
    contact_person_phone = models.CharField(max_length=20, blank=True)
    owner_name = models.CharField(max_length=100, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["boat", "-created_at"]),
        ]
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Violation: {self.boat_name} in {self.to_municipality} for {self.dwell_duration//60} minutes"


class ViolationStatusAuditLog(models.Model):
    """Audit log for violation status changes - tracks who changed what and when"""
    violation = models.ForeignKey(BoundaryViolationNotification, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='violation_audits')
    user_role = models.CharField(max_length=100, help_text='Role of user who made the change')
    
    # Change tracking
    old_status = models.CharField(max_length=50)
    new_status = models.CharField(max_length=50)
    old_remarks = models.TextField(blank=True)
    new_remarks = models.TextField(blank=True)
    remarks_changed = models.BooleanField(default=False)
    
    # Metadata
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['violation', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user_name} changed {self.violation.boat_name}: {self.old_status} → {self.new_status}"
    
    @property
    def user_name(self):
        """Robust display name for audit logs: prefer User first/last; fallback to attached profile names; then email; then ID."""
        u = getattr(self, 'user', None)
        if not u:
            return "System"
        # Try direct fields on custom User (may not exist)
        try:
            fn = getattr(u, 'first_name', '') or ''
            ln = getattr(u, 'last_name', '') or ''
            if (fn or ln):
                return f"{fn} {ln}".strip()
        except Exception:
            pass
        # Try related profiles
        for rel in ('municipal_agriculturist', 'provincial_agriculturist', 'admin_profile'):
            try:
                prof = getattr(u, rel, None)
                if prof:
                    fn = getattr(prof, 'first_name', '') or ''
                    ln = getattr(prof, 'last_name', '') or ''
                    if (fn or ln):
                        return f"{fn} {ln}".strip()
            except Exception:
                continue
        # Fallbacks
        try:
            return getattr(u, 'email', None) or str(getattr(u, 'username', 'User'))
        except Exception:
            return "User"


# Municipality Management Models
class Municipality(models.Model):
    IDENTIFIER_ICON_CHOICES = [
        ('circle', 'Circle'),
        ('triangle', 'Triangle')
    ]
    
    municipality_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    prefix = models.CharField(max_length=3, unique=True, blank=True, null=True, help_text='3-letter prefix for registration numbers (auto-generated from municipality name)')
    color = models.CharField(max_length=7, default='#3B82F6')  # Hex color code
    identifier_icon = models.CharField(max_length=20, choices=IDENTIFIER_ICON_CHOICES, default='circle', help_text='Map marker icon shape for all boats in this municipality')
    is_coastal = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Municipalities'
    
    def __str__(self):
        return self.name


class Barangay(models.Model):
    barangay_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    municipality = models.ForeignKey(Municipality, on_delete=models.CASCADE, related_name='barangays')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        unique_together = ['name', 'municipality']
        verbose_name_plural = 'Barangays'
    
    def __str__(self):
        return f"{self.name}, {self.municipality.name}"


class BarangayVerifier(models.Model):
    POSITION_CHOICES = [
        ('Barangay Captain', 'Barangay Captain'),
        ('Barangay Secretary', 'Barangay Secretary'),
        ('Fishing Coordinator', 'Fishing Coordinator'),
    ]
    
    municipality = models.ForeignKey(Municipality, on_delete=models.CASCADE, related_name='verifiers')
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='verifiers')
    position = models.CharField(max_length=50, choices=POSITION_CHOICES)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['municipality__name', 'barangay__name', 'position']
        unique_together = ['barangay', 'position']
        verbose_name_plural = 'Barangay Verifiers'
    
    def __str__(self):
        muni = getattr(self.municipality, 'name', None) or 'Province'
        brgy = getattr(self.barangay, 'name', None)
        loc = f"{muni}{f' - {brgy}' if brgy else ''}"
        return f"{self.first_name} {self.last_name} - {self.position} ({loc})"


class TrackerStatusEvent(models.Model):
    """
    Stores tracker status transition events with state machine logic.
    Only records status changes, not every GPS ping.
    """
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('reconnecting', 'Reconnecting'),
        ('reconnected', 'Reconnected'),
    ]
    
    tracker_id = models.CharField(max_length=50, db_index=True, help_text="BirukBilug tracker ID")
    mfbr_number = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    boat_id = models.IntegerField(null=True, blank=True, db_index=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    previous_status = models.CharField(max_length=20, null=True, blank=True)
    
    # Timestamp of the status change
    timestamp = models.DateTimeField(db_index=True)
    
    # For online sessions: store the initial online timestamp
    session_start = models.DateTimeField(null=True, blank=True, help_text="Initial online timestamp for this session")
    
    # Location at time of status change
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['tracker_id', '-timestamp']),
            models.Index(fields=['mfbr_number', '-timestamp']),
        ]
        verbose_name_plural = 'Tracker Status Events'
    
    def __str__(self):
        return f"{self.tracker_id} - {self.status} at {self.timestamp}"
    
    @classmethod
    def record_transition(cls, tracker_id, new_status, timestamp, mfbr_number=None, boat_id=None, latitude=None, longitude=None):
        """
        State machine: Only record status transitions, not duplicate states.
        Returns (event, created) tuple.
        """
        from django.utils import timezone
        
        # Get the most recent status event for this tracker
        last_event = cls.objects.filter(tracker_id=tracker_id).order_by('-timestamp').first()
        
        # Determine if this is a state transition
        previous_status = last_event.status if last_event else None
        
        # Skip if status hasn't changed
        if previous_status == new_status:
            return (None, False)
        
        # Special handling for reconnected state
        # Online after offline/reconnecting becomes "reconnected"
        if new_status == 'online' and previous_status in ['offline', 'reconnecting']:
            new_status = 'reconnected'
        
        # Determine session start
        session_start = None
        if new_status in ['online', 'reconnected']:
            if previous_status in ['offline', 'reconnecting', None]:
                # New session starting
                session_start = timestamp
            elif last_event and last_event.session_start:
                # Continue existing session
                session_start = last_event.session_start
        
        # Create the status event
        event = cls.objects.create(
            tracker_id=tracker_id,
            mfbr_number=mfbr_number,
            boat_id=boat_id,
            status=new_status,
            previous_status=previous_status,
            timestamp=timestamp,
            session_start=session_start,
            latitude=latitude,
            longitude=longitude
        )
        
        return (event, True)


class Signatory(models.Model):
    POSITION_CHOICES = [
        ('Provincial Agriculturist', 'Provincial Agriculturist'),
        ('Municipal Agriculturist', 'Municipal Agriculturist'),
        ('Municipal Fishery Coordinator', 'Municipal Fishery Coordinator'),
        ('Mayor', 'Mayor'),
    ]
    
    municipality = models.ForeignKey(Municipality, on_delete=models.CASCADE, related_name='signatories', null=True, blank=True)
    barangay = models.ForeignKey(Barangay, on_delete=models.CASCADE, related_name='signatories', null=True, blank=True)
    position = models.CharField(max_length=50, choices=POSITION_CHOICES)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['municipality__name', 'barangay__name', 'position']
        unique_together = ['municipality', 'position']
        verbose_name_plural = 'Signatories'
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.position} ({self.barangay.name})"
