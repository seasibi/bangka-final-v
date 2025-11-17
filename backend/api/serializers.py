from rest_framework import serializers
from .models import GpsData, User, Boat,  Fisherfolk, FisherfolkBoat, MunicipalAgriculturist, ProvincialAgriculturist, ActivityLog, Address, Household, Organization, Contacts, BirukbilugTracker, MunicipalityBoundary, DeviceToken, LandBoundary, BoundaryViolationNotification, Municipality, Barangay, BarangayVerifier, Signatory
from .gear_serializers import BoatMeasurementsSerializer, BoatGearAssignmentSerializer, BoatGearTypeAssignmentSerializer, BoatGearSubtypeAssignmentSerializer

import re
from datetime import date
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from PIL import Image


# @receiver(post_save, sender=Fisherfolk)
# def log_fisherfolk_created(sender, instance, created, **kwargs):
#     if created:
#         ActivityLog.objects.create(
#             user=instance.created_by,  # or another user reference
#             action=f"Fisherfolk {instance} was created",
#         )
        
        
class MunicipalAgriculturistSerializer(serializers.ModelSerializer):
    class Meta:
        model = MunicipalAgriculturist
        fields = ['municipal_agriculturist_id','first_name', 'middle_name', 'last_name', 'sex', 'municipality', 'contact_number', 'position']

class ProvincialAgriculturistSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProvincialAgriculturist
        fields = ['provincial_agriculturist_id','first_name', 'middle_name', 'last_name', 'sex', 'contact_number', 'position']

class UserSerializer(serializers.ModelSerializer):
    municipal_agriculturist = MunicipalAgriculturistSerializer(read_only=True)
    provincial_agriculturist = ProvincialAgriculturistSerializer(read_only=True)
    
    # Fields for creating/updating agriculturist
    first_name = serializers.CharField(write_only=True)
    middle_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True)
    sex = serializers.CharField(write_only=True)
    contact_number = serializers.CharField(write_only=True)
    position = serializers.CharField(write_only=True)
    municipality = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'user_role', 'is_active',
            'municipal_agriculturist', 'provincial_agriculturist',
            'first_name', 'middle_name', 'last_name', 'sex', 
            'contact_number', 'position', 'municipality'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {
                'error_messages': {
                    'unique': 'A user with this email address already exists.',
                    'invalid': 'Enter a valid email address.',
                }
            }
        }

    def validate(self, data):
        # Check if trying to deactivate an admin user
        if 'is_active' in data and not data['is_active']:
            if self.instance and self.instance.user_role == 'admin':
                raise serializers.ValidationError({
                    "is_active": "Admin accounts cannot be deactivated"
                })

        # Require municipality only for municipal agriculturists
        user_role = data.get('user_role')
        if not user_role and self.instance:
            user_role = self.instance.user_role

        if user_role == 'municipal_agriculturist':
            municipality = data.get('municipality')
            if not municipality:
                raise serializers.ValidationError({'municipality': 'This field is required for Municipal Agriculturists.'})
        
        # Validate email uniqueness using canonical form (gmail aliases collapsed)
        def _canon(e: str) -> str:
            e = (e or '').strip().lower()
            if '@' not in e:
                return e
            local, domain = e.split('@', 1)
            if domain in ('gmail.com', 'googlemail.com'):
                local = local.split('+', 1)[0].replace('.', '')
                domain = 'gmail.com'
            return f"{local}@{domain}"

        email_raw = data.get('email', '')
        email = email_raw.lower()
        target = _canon(email_raw)

        # Email uniqueness check across all users by canonical form
        existing = [ _canon(u.email) for u in User.objects.all() ]
        if self.instance:
            existing = [ c for u, c in zip(User.objects.all(), existing) if u.pk != self.instance.pk ]
        if target in existing:
            raise serializers.ValidationError({
                'email': 'A user with this email address already exists.'
            })

        # Convert email to lowercase for storage
        if 'email' in data:
            data['email'] = email
        
        return data

    def validate_user_role(self, value):
        value = value.strip().lower()  
        if value not in dict(User.USER_ROLES).keys():
            raise serializers.ValidationError("Invalid user role")
        return value

    def validate_contact_number(self, value):
        if value:
            # Handle both formats: 09XXXXXXXXX or +639XXXXXXXXX
            if value.startswith('+63'):
                # Remove +63 prefix and validate remaining number
                number = value[3:]  # Skip +63
                if not number.startswith('9') or len(number) != 10:
                    raise serializers.ValidationError(
                        "Phone number must be in format 09XXXXXXXXX or +639XXXXXXXXX"
                    )
            elif value.startswith('09'):
                # Already in 09XXXXXXXXX format
                if len(value) != 11:
                    raise serializers.ValidationError(
                        "Phone number must be in format 09XXXXXXXXX or +639XXXXXXXXX"
                    )
            else:
                raise serializers.ValidationError(
                    "Phone number must be in format 09XXXXXXXXX or +639XXXXXXXXX"
                )
            
            # Standardize format to +63 format
            if value.startswith('0'):
                return f"+63{value[1:]}"  # Convert 09... to +639...
            return value  # Already in +63 format
        return value

    def validate_sex(self, value):
        if value:
            value = value.lower()
            if value not in dict(User.GENDER_CHOICES).keys():
                raise serializers.ValidationError("Sex must be either 'male' or 'female'")
        return value

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email is required.")
        
        # Convert to lowercase for validation
        value = value.lower()
        
        # Basic email format validation
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            raise serializers.ValidationError("Enter a valid email address.")
        
        return value

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['user_role'] = instance.user_role.strip().lower()
        if instance.sex:
            representation['sex'] = instance.sex.lower()
        if instance.municipal_agriculturist:
            representation['municipality'] = instance.municipal_agriculturist.municipality
        return representation

    def create(self, validated_data):
        # Extract profile data common to all roles
        profile_data = {
            'first_name': validated_data.pop('first_name'),
            'middle_name': validated_data.pop('middle_name', ''),
            'last_name': validated_data.pop('last_name'),
            'sex': validated_data.pop('sex'),
            'contact_number': validated_data.pop('contact_number'),
            'position': validated_data.pop('position'),
            'status': 'Active' if validated_data.get('is_active', True) else 'Inactive',
        }

        user_role = validated_data.get('user_role')
        municipality_name = validated_data.pop('municipality', None)

        # Attach role-specific related profile
        if user_role == 'municipal_agriculturist':
            profile_data['municipality'] = municipality_name
            ma = MunicipalAgriculturist.objects.create(**profile_data)
            validated_data['municipal_agriculturist'] = ma
        elif user_role == 'provincial_agriculturist':
            pa = ProvincialAgriculturist.objects.create(**profile_data)
            validated_data['provincial_agriculturist'] = pa
        elif user_role == 'admin':
            from .models import AdminProfile
            ap = AdminProfile.objects.create(**profile_data)
            validated_data['admin_profile'] = ap
        else:
            # Fallback: create provincial profile
            pa = ProvincialAgriculturist.objects.create(**profile_data)
            validated_data['provincial_agriculturist'] = pa

        # Create user
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        # Collect profile fields if present
        profile_updates = {}
        for field in ['first_name', 'middle_name', 'last_name', 'sex', 'contact_number', 'position', 'municipality']:
            if field in validated_data:
                profile_updates[field] = validated_data.pop(field)

        # Determine target role (may be same as current)
        target_role = validated_data.get('user_role', instance.user_role)

        # If role is changing, (re)attach the appropriate related profile
        if target_role != instance.user_role:
            from .models import AdminProfile
            # Detach all first to prevent cross-role leakage
            instance.municipal_agriculturist = None
            instance.provincial_agriculturist = None
            instance.admin_profile = None

            if target_role == 'municipal_agriculturist':
                muni = profile_updates.get('municipality') or getattr(instance.municipal_agriculturist, 'municipality', None)
                if not muni:
                    raise serializers.ValidationError({'municipality': 'This field is required for Municipal Agriculturists.'})
                data = {
                    'first_name': profile_updates.get('first_name', getattr(instance, 'first_name', None)),
                    'middle_name': profile_updates.get('middle_name', ''),
                    'last_name': profile_updates.get('last_name', getattr(instance, 'last_name', None)),
                    'sex': profile_updates.get('sex', None),
                    'contact_number': profile_updates.get('contact_number', None),
                    'position': profile_updates.get('position', None),
                    'status': 'Active' if validated_data.get('is_active', instance.is_active) else 'Inactive',
                    'municipality': muni,
                }
                ma = MunicipalAgriculturist.objects.create(**{k:v for k,v in data.items() if v is not None})
                instance.municipal_agriculturist = ma
            elif target_role == 'provincial_agriculturist':
                data = {
                    'first_name': profile_updates.get('first_name', None),
                    'middle_name': profile_updates.get('middle_name', ''),
                    'last_name': profile_updates.get('last_name', None),
                    'sex': profile_updates.get('sex', None),
                    'contact_number': profile_updates.get('contact_number', None),
                    'position': profile_updates.get('position', None),
                    'status': 'Active' if validated_data.get('is_active', instance.is_active) else 'Inactive',
                }
                pa = ProvincialAgriculturist.objects.create(**{k:v for k,v in data.items() if v is not None})
                instance.provincial_agriculturist = pa
            elif target_role == 'admin':
                data = {
                    'first_name': profile_updates.get('first_name', None),
                    'middle_name': profile_updates.get('middle_name', ''),
                    'last_name': profile_updates.get('last_name', None),
                    'sex': profile_updates.get('sex', None),
                    'contact_number': profile_updates.get('contact_number', None),
                    'position': profile_updates.get('position', None),
                    'status': 'Active' if validated_data.get('is_active', instance.is_active) else 'Inactive',
                }
                ap = AdminProfile.objects.create(**{k:v for k,v in data.items() if v is not None})
                instance.admin_profile = ap

            # Finally set the role
            instance.user_role = target_role
        else:
            # Role unchanged: update existing attached profile if any
            if instance.user_role == 'municipal_agriculturist' and instance.municipal_agriculturist:
                for k, v in profile_updates.items():
                    setattr(instance.municipal_agriculturist, k, v)
                instance.municipal_agriculturist.save()
            elif instance.user_role == 'provincial_agriculturist' and instance.provincial_agriculturist:
                for k, v in profile_updates.items():
                    if k != 'municipality':
                        setattr(instance.provincial_agriculturist, k, v)
                instance.provincial_agriculturist.save()
            elif instance.user_role == 'admin' and instance.admin_profile:
                for k, v in profile_updates.items():
                    if k != 'municipality':
                        setattr(instance.admin_profile, k, v)
                instance.admin_profile.save()

        # Update password if provided
        if 'password' in validated_data:
            password = validated_data.pop('password')
            instance.set_password(password)

        # Update simple fields on user
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance
    


# --- Custom Nested Serializer for Boat Creation ---
class BoatNestedSerializer(serializers.ModelSerializer):
    measurements = BoatMeasurementsSerializer()
    gear_assignment = BoatGearAssignmentSerializer()

    class Meta:
        model = Boat
        fields = [
            'mfbr_number', 'application_date', 'type_of_registration', 'fisherfolk_registration_number',
            'type_of_ownership', 'boat_name', 'boat_type', 'fishing_ground', 'fma_number', 'built_place',
            'no_fishers', 'material_used', 'homeport', 'built_year', 'engine_make', 'serial_number',
            'horsepower', 'is_active', 'boat_image', 'measurements', 'gear_assignment'
        ]

    def create(self, validated_data):
        measurements_data = validated_data.pop('measurements')
        gear_data = validated_data.pop('gear_assignment')
        boat = Boat.objects.create(**validated_data)
        BoatMeasurements.objects.create(boat=boat, **measurements_data)
        BoatGearAssignment.objects.create(boat=boat, **gear_data)
        return boat

"""
# The following serializers are commented out because they are not currently used in the registration workflow.
# Uncomment and implement them if you need to serialize gear, measurements, or tracking data for boats.
# class BoatBirukbilugTrackerSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = BoatBirukbilugTracker
#         fields = ['TrackingNo', 'BirukBilugID', 'BoatRegistryNo', 'Timestamp', 'Longitude', 'Latitude']



"""

class BirukbilugTrackerSerializer(serializers.ModelSerializer):
    # Read-only display
    boat = serializers.StringRelatedField(read_only=True)  
    # Convenience: expose boat MFBR and owner details (read-only)
    boat_mfbr = serializers.CharField(source='boat.mfbr_number', read_only=True)
    owner_registration = serializers.CharField(source='boat.fisherfolk_registration_number.registration_number', read_only=True)
    owner_name = serializers.SerializerMethodField(read_only=True)
    
    # Writable field for assignment/unassignment
    mfbr_number = serializers.PrimaryKeyRelatedField(
        queryset=Boat.objects.all(),
        source="boat",
        write_only=True,
        required=False,
        allow_null=True   # ✅ allow null for unassign
    )

    class Meta:
        model = BirukbilugTracker
        fields = [
            'BirukBilugID',  # Fixed case to match model field
            'municipality',
            'status',
            'date_added',
            'provisional',   # Indicates incomplete provisioning
            'boat',          # string (read-only)
            'boat_mfbr',
            'owner_registration',
            'owner_name',
            'mfbr_number'    # writable (ID or null)
        ]
        read_only_fields = ['date_added']  # Remove BirukBilugID from read-only since it's auto-generated in view

    def get_owner_name(self, obj):
        try:
            ff = getattr(obj.boat, 'fisherfolk_registration_number', None)
            if not ff:
                return None
            parts = [ff.first_name, ff.middle_name or '', ff.last_name]
            return ' '.join([p for p in parts if p]).strip()
        except Exception:
            return None

class FisherfolkBoatSerializer(serializers.ModelSerializer):
    class Meta:
        model = FisherfolkBoat
        fields = ['boat_registry_no', 'registration_number', 'mfbr_number', 'type_of_ownership', 
                 'no_of_fishers', 'homeport', 'date_added', 'is_active']
    
    def validate_is_active(self, value):
        # Accept both boolean and string "true"/"false"
        if isinstance(value, str):
            return value.lower() == "true"
        return bool(value)
    
# BoatLocationUpdateSerializer is commented out for now, as tracking models are not active
# class BoatLocationUpdateSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = BoatBirukbilugTracker
#         fields = ['Longitude', 'Latitude', 'Timestamp']
#     def update(self, instance, validated_data):
#         # Tracking logic here
#         pass

# Address Serializer
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ['address_log', 'date_added']
# Household Serializer
class HouseholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Household
        fields = '__all__'
        read_only_fields = ['household_number', 'date_added']

# Organization Serializer
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["org_id", "org_name", "member_since", "org_position"]
        read_only_fields = ['org_id', 'date_added']

# Contacts Serializer
class ContactsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contacts
        fields = '__all__'
        read_only_fields = ['contact_id', 'date_added']

class FisherfolkSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    # Accept any string list; we'll validate/massage values ourselves to avoid DRF nested index errors
    other_source_livelihood = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True,
        required=False
    )
    fisherfolk_img = serializers.ImageField(required=False)
    address = AddressSerializer(read_only=True)
    contacts = ContactsSerializer(read_only=True)
    household = HouseholdSerializer(read_only=True)
    organizations = OrganizationSerializer(many=True, read_only=True)
    class Meta:
        model = Fisherfolk
        fields = "__all__"
        read_only_fields = ["date_added", "created_by"]
        depth = 1

    def validate(self, data):
        # Check for existing fisherfolk with same name and birth date
        first_name = data.get('first_name', '').strip().title()
        middle_name = data.get('middle_name', '').strip().title() if data.get('middle_name') else None
        last_name = data.get('last_name', '').strip().title()
        birth_date = data.get('birth_date')

        # Skip validation if any of the required fields are missing
        if not all([first_name, last_name, birth_date]):
            return data

        # Build the query
        existing_query = Fisherfolk.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name,
            birth_date=birth_date
        )

        # Add middle name to query if provided
        if middle_name:
            existing_query = existing_query.filter(middle_name__iexact=middle_name)
        else:
            existing_query = existing_query.filter(middle_name__isnull=True)

        # Exclude current instance in case of update
        if self.instance:
            existing_query = existing_query.exclude(pk=self.instance.pk)

        if existing_query.exists():
            existing = existing_query.first()
            raise serializers.ValidationError({
                'non_field_errors': [
                    f'A fisherfolk with these details already exists (Registration Number: {existing.registration_number})'
                ]
            })

        # Validate birth_date
        if birth_date:
            today = timezone.now().date()
            
            # Check if birth_date is in the future
            if birth_date > today:
                raise serializers.ValidationError({
                    'birth_date': 'Birth date cannot be in the future.'
                })
            
            # Calculate age
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            
            # Check if person is at least 18 years old
            if age < 18:
                raise serializers.ValidationError({
                    'birth_date': 'Fisherfolk must be at least 18 years old.'
                })

        return data

    def validate_other_source_livelihood(self, value):
        """Coerce to canonical choices, ignore invalid values, and dedupe."""
        if value is None:
            return []
        choice_map = {c[0].lower(): c[0] for c in Fisherfolk.LIVELIHOOD_CHOICES}
        cleaned = []
        try:
            for v in value if isinstance(value, (list, tuple)) else [value]:
                key = str(v).strip().lower()
                if key in choice_map:
                    cleaned.append(choice_map[key])
        except Exception:
            cleaned = []
        # dedupe while preserving order
        seen = set()
        result = []
        for v in cleaned:
            if v not in seen:
                seen.add(v)
                result.append(v)
        return result

    def validate_contact_number(self, value):
        if value:
            # Handle both formats: 09XXXXXXXXX or +639XXXXXXXXX
            if value.startswith('+63'):
                # Remove +63 prefix and validate remaining number
                number = value[3:]  # Skip +63
                if not number.startswith('9') or len(number) != 10:
                    raise serializers.ValidationError(
                        "Phone number must be in format 09XXXXXXXXX or +639XXXXXXXXX"
                    )
            elif value.startswith('09'):
                # Already in 09XXXXXXXXX format
                if len(value) != 11:
                    raise serializers.ValidationError(
                        "Phone number must be in format 09XXXXXXXXX or +639XXXXXXXXX"
                    )
            else:
                raise serializers.ValidationError(
                    "Phone number must be in format 09XXXXXXXXX or +639XXXXXXXXX"
                )
            
            # Standardize format to +63 format
            if value.startswith('0'):
                return f"+63{value[1:]}"  # Convert 09... to +639...
            return value
        return value

    def to_internal_value(self, data):
        """
        Preprocess incoming payload for fields that often arrive in non-standard formats
        - other_source_livelihood: accept list, JSON string, comma-separated string, MultiValueDict getlist, list of objects
        - organizations: accept flattened form-data organizations[i][field] and JSON string
        """
        # Make a shallow, mutable copy to avoid mutating the original request.data
        try:
            mutable = data.copy()
        except Exception:
            mutable = dict(data)

        # Normalize other_source_livelihood before DRF field validation
        try:
            raw_osl = None
            # Prefer list from MultiValueDict if available
            req = self.context.get("request")
            if req is not None and hasattr(req, "data"):
                # Typical React/HTML checkbox arrays
                if hasattr(req.data, "getlist"):
                    raw_osl = req.data.getlist("other_source_livelihood[]") or req.data.getlist("other_source_livelihood")
                # If keys are like other_source_livelihood[0]
                if not raw_osl:
                    try:
                        keys = [k for k in req.data.keys() if "other_source_livelihood" in str(k)]
                        vals = []
                        for k in keys:
                            v = req.data.get(k)
                            if hasattr(req.data, "getlist"):
                                lst = req.data.getlist(k)
                                if lst:
                                    vals.extend(lst)
                                    continue
                            if v is not None:
                                vals.append(v)
                        if vals:
                            raw_osl = vals
                    except Exception:
                        pass
            if not raw_osl:
                raw_osl = mutable.get("other_source_livelihood")

            normalized = []
            if raw_osl is not None:
                import json as _json
                def _flatten(items):
                    out = []
                    for it in items:
                        if isinstance(it, dict):
                            v = it.get("value") or it.get("label") or it.get("name")
                            if isinstance(v, (list, tuple)):
                                out.extend([str(x) for x in v])
                            elif v:
                                out.append(str(v))
                        else:
                            out.append(str(it))
                    return out
                if isinstance(raw_osl, list) or isinstance(raw_osl, tuple):
                    normalized = _flatten(list(raw_osl))
                elif isinstance(raw_osl, dict):
                    # Checkbox map like {"Capture Fishing": true, ...}
                    normalized = [k for k, v in raw_osl.items() if v in (True, "true", "on", "1", 1)]
                elif isinstance(raw_osl, str):
                    s = raw_osl.strip()
                    if s.lower() == "[object object]":
                        normalized = []
                    elif s.startswith("[") and s.endswith("]"):
                        try:
                            parsed = _json.loads(s)
                            if isinstance(parsed, list):
                                normalized = _flatten(parsed)
                        except Exception:
                            # Fallback: split by comma
                            normalized = [p.strip() for p in s.strip("[]").split(",") if p.strip()]
                    else:
                        # Comma-separated string
                        normalized = [p.strip() for p in s.split(",") if p.strip()]
                # Map case-insensitively to canonical choices, drop invalids, dedupe
                choice_map = {c[0].lower(): c[0] for c in Fisherfolk.LIVELIHOOD_CHOICES}
                canon = []
                for v in normalized:
                    key = str(v).strip().lower()
                    if key in choice_map:
                        canon.append(choice_map[key])
                canon = list(dict.fromkeys(canon))
                try:
                    if hasattr(mutable, 'setlist'):
                        mutable.setlist('other_source_livelihood', canon)
                    else:
                        mutable["other_source_livelihood"] = canon
                except Exception:
                    mutable["other_source_livelihood"] = canon
        except Exception:
            # Never block create/update due to parsing; let DRF continue
            pass

        # Let DRF do normal conversion/validation
        ret = super().to_internal_value(mutable)

        # Also parse organizations when they are provided as a JSON string in multipart/form-data
        orgs = data.get("organizations")
        if orgs and isinstance(orgs, str):
            import json
            try:
                ret["organizations"] = json.loads(orgs)
            except json.JSONDecodeError:
                ret["organizations"] = []
        return ret

    def create(self, validated_data):
        request = self.context.get("request")
        org_data_list = []

        # Parse flattened organization fields from request.data
        if request:
            import re
            for key, value in request.data.items():
                match = re.match(r'organizations\[(\d+)\]\[(\w+)\]', key)
                if match:
                    index, field = match.groups()
                    index = int(index)
                    while len(org_data_list) <= index:
                        org_data_list.append({})
                    org_data_list[index][field] = value

        # Set created_by
        if "created_by" not in validated_data:
            if request and hasattr(request, "user") and request.user.is_authenticated:
                validated_data["created_by"] = request.user
            else:
                raise serializers.ValidationError("A valid user is required to create a Fisherfolk record.")

        # Remove any accidental read-only payload we might have added earlier
        validated_data.pop("organizations", None)

        # Extract and sanitize other_source_livelihood (already validated via validate_other_source_livelihood)
        osl = validated_data.pop("other_source_livelihood", []) or []
        if not isinstance(osl, (list, tuple)):
            osl = [str(osl)] if osl else []
        # Coerce values again defensively
        choice_map = {c[0].lower(): c[0] for c in Fisherfolk.LIVELIHOOD_CHOICES}
        osl = [choice_map.get(str(v).strip().lower()) for v in osl]
        osl = [v for v in osl if v]
        # Dedupe preserve order
        seen = set(); _osl = []
        for v in osl:
            if v not in seen:
                seen.add(v); _osl.append(v)
        osl = _osl

        # Create Fisherfolk explicitly to avoid model kwargs errors
        fisherfolk = Fisherfolk.objects.create(**validated_data)
        if osl:
            fisherfolk.other_source_livelihood = osl
            fisherfolk.save(update_fields=["other_source_livelihood"])

        # Create organizations
        from datetime import datetime
        for org_data in org_data_list:
            name = org_data.get("org_name") or ""
            if name.strip().lower() in ("other", "others", ""):
                custom = (
                    org_data.get("organization_name")
                    or org_data.get("org_custom_name")
                    or org_data.get("org_other")
                    or org_data.get("custom_org_name")
                    or org_data.get("orgname")
                    or org_data.get("orgname_other")
                )
                if custom:
                    org_data["org_name"] = str(custom).strip()
            ms = org_data.get("member_since")
            if isinstance(ms, str) and "/" in ms and "-" not in ms:
                try:
                    org_data["member_since"] = datetime.strptime(ms, "%d/%m/%Y").date()
                except Exception:
                    pass
            if any(org_data.get(field) for field in ["org_name", "member_since", "org_position"]):
                if not org_data.get("org_name"):
                    continue
                Organization.objects.create(
                    fisherfolk=fisherfolk,
                    **{k: v for k, v in org_data.items() if k in ["org_name", "member_since", "org_position"]}
                )
        return fisherfolk


    def update(self, instance, validated_data):
        # DEBUG: log incoming OSL payload shape
        try:
            import pprint as _pp
            _raw = None
            req = self.context.get("request")
            if req is not None:
                try:
                    _raw = {
                        "getlist[]": getattr(req.data, "getlist", lambda *_: [])("other_source_livelihood[]"),
                        "getlist": getattr(req.data, "getlist", lambda *_: [])("other_source_livelihood"),
                        "raw": req.data.get("other_source_livelihood"),
                    }
                except Exception:
                    _raw = {"raw": str(getattr(req, "data", "<no data>"))[:200]}
            print("[FisherfolkSerializer.update] incoming OSL ->", _pp.pformat(_raw))
        except Exception:
            pass
        # Handle OSL explicitly to ensure persistence with MultiSelectField
        osl = validated_data.pop("other_source_livelihood", None)

        # If client explicitly sent the OSL key but empty (e.g., [] or no repeated items),
        # DRF may not include it in validated_data. Detect that intent here and clear it.
        if osl is None:
            try:
                req = self.context.get("request")
                if req is not None and hasattr(req, "data"):
                    keys = list(getattr(req.data, "keys", lambda: [])())
                    has_osl_key = any("other_source_livelihood" in str(k) for k in keys)
                    if has_osl_key:
                        explicit_empty = False
                        if hasattr(req.data, "getlist"):
                            lst = req.data.getlist("other_source_livelihood[]") or req.data.getlist("other_source_livelihood")
                            # Treat [""], [null], etc. as empty intent
                            if not lst or all((str(v).strip() == "" for v in lst)):
                                explicit_empty = True
                        raw = req.data.get("other_source_livelihood")
                        if isinstance(raw, str) and raw.strip() in ("[]", ""):
                            explicit_empty = True
                        if explicit_empty:
                            osl = []
            except Exception:
                pass

        if osl is not None:
            if not isinstance(osl, (list, tuple)):
                osl = [osl] if osl else []
            choice_map = {c[0].lower(): c[0] for c in Fisherfolk.LIVELIHOOD_CHOICES}
            cleaned = []
            for v in osl:
                key = str(v).strip().lower()
                if key in choice_map:
                    cleaned.append(choice_map[key])
            # dedupe
            seen = set(); final = []
            for v in cleaned:
                if v not in seen:
                    seen.add(v); final.append(v)
            # When clearing, some backends prefer None for MultiSelectField(null=True)
            instance.other_source_livelihood = final if final else []
        # Clear free-text if "Others" not selected in other_source_livelihood
        try:
            osl_now = list(instance.other_source_livelihood or [])
            if not (osl_now and "Others" in osl_now):
                if "other_source_income" in validated_data:
                    pass  # let payload override if provided
                else:
                    instance.other_source_income = ""
        except Exception:
            pass
        # Clear main free-text if main_source_livelihood is not "Others"
        try:
            msl = validated_data.get("main_source_livelihood", getattr(instance, "main_source_livelihood", None))
            if msl and str(msl) != "Others":
                instance.other_main_source_livelihood = ""
        except Exception:
            pass
        # Update remaining fields
        for k, v in validated_data.items():
            setattr(instance, k, v)
        try:
            print("[FisherfolkSerializer.update] saved OSL:", list(instance.other_source_livelihood or []), "free-text:", getattr(instance, "other_source_income", ""))
        except Exception:
            pass
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request', None)
        # Ensure organizations are always a list
        try:
            orgs = getattr(instance, 'organizations', None)
            if orgs is not None and hasattr(orgs, 'all'):
                data['organizations'] = OrganizationSerializer(orgs.all(), many=True).data
        except Exception:
            pass
        if instance.fisherfolk_img:
            if request:
                data['fisherfolk_img'] = request.build_absolute_uri(instance.fisherfolk_img.url)
            else:
                data['fisherfolk_img'] = instance.fisherfolk_img.url
        else:
            data['fisherfolk_img'] = None
        # Ensure other_source_livelihood is always a list of strings
        try:
            osl = getattr(instance, 'other_source_livelihood', [])
            if isinstance(osl, (list, tuple)):
                data['other_source_livelihood'] = list(osl)
            elif isinstance(osl, str) and osl:
                import json as _json
                try:
                    parsed = _json.loads(osl)
                    data['other_source_livelihood'] = parsed if isinstance(parsed, list) else [osl]
                except Exception:
                    data['other_source_livelihood'] = [s.strip() for s in osl.split(',') if s.strip()]
            else:
                data['other_source_livelihood'] = []
        except Exception:
            data['other_source_livelihood'] = []

        # If "Others" is in OSL but free-text is missing in representation, include it (defensive)
        try:
            if 'other_source_livelihood' in data and 'Others' in data['other_source_livelihood']:
                if not (data.get('other_source_income') or '').strip():
                    # Look up raw field from instance to avoid omission by depth/read_only
                    other_txt = getattr(instance, 'other_source_income', '') or ''
                    data['other_source_income'] = other_txt
        except Exception:
            pass
        return data


class BoatSerializer(serializers.ModelSerializer):

    fisherfolk = FisherfolkSerializer(source='fisherfolk_registration_number', read_only=True)
    boat_image = serializers.ImageField(required=False)
    boatmeasure = BoatMeasurementsSerializer(source='measurements', read_only=True)  # <-- match related_name
    gear_assignments = BoatGearAssignmentSerializer(source='boatgearassignment_set', many=True, read_only=True)
    tracker = serializers.SerializerMethodField()

    fisherfolk_registration_number = serializers.PrimaryKeyRelatedField(
        queryset=Fisherfolk.objects.all(),
        write_only=True,
        required=False  # Not required for updates
    )
    # location_history and tracking fields are commented out for now
    # location_history = BoatBirukbilugTrackerSerializer(many=True, read_only=True, source='fisherfolkboat_set.boatbirukbilugtracker_set')
    class Meta:
        model = Boat
        fields = '__all__'
        read_only_fields = ['date_added']  # Remove mfbr_number from here to allow creation
    def get_tracker(self, obj):
        tracker = BirukbilugTracker.objects.filter(boat=obj).first()  # Fixed query to use 'boat' field
        if tracker:
            return {
                'BirukBilugID': tracker.BirukBilugID,  # Fixed case to match model field
                'municipality': tracker.municipality,
                'status': tracker.status
            }
        return None
    def validate_boat_name(self, value):
        if value is None or value.strip() == "":
            return "Unnamed"
        if value.lower() == "unnamed":
            return "Unnamed"
        # Check for uniqueness except for "Unnamed"
        existing_query = Boat.objects.filter(boat_name__iexact=value)
        # If this is an update, exclude the current instance
        if self.instance:
            existing_query = existing_query.exclude(pk=self.instance.pk)
        if existing_query.exists():
            raise serializers.ValidationError("Boat name must be unique.")
        return value
    def validate(self, data):
        print("\n=== BoatSerializer.validate() DEBUG ===")
        print(f"self.instance: {self.instance}")
        print(f"data keys: {list(data.keys())}")
        print(f"mfbr_number in data: {'mfbr_number' in data}")
        print(f"mfbr_number value: {data.get('mfbr_number', 'NOT FOUND')}")
        print("==========================================\n")
        
        boat_name = data.get('boat_name', '').strip().title() if data.get('boat_name') else "Unnamed"
        # Only enforce uniqueness if not "Unnamed"
        if boat_name != "Unnamed":
            existing_query = Boat.objects.filter(boat_name__iexact=boat_name)
            if self.instance:
                existing_query = existing_query.exclude(pk=self.instance.pk)
            if existing_query.exists():
                raise serializers.ValidationError({
                    'non_field_errors': [
                        'A boat with this name already exists.'
                    ]
                })
        # Set boat_name to "Unnamed" if blank or None
        data['boat_name'] = boat_name    
        # If this is an update operation
        if self.instance is not None:
            # For updates, we don't need to validate mfbr_number as it's the primary key
            if 'mfbr_number' in data:
                data.pop('mfbr_number')  # Remove mfbr_number from update data
            # For updates, don't require fisherfolk_registration_number if not provided
            if 'fisherfolk_registration_number' not in data:
                # Use the existing fisherfolk_registration_number from the instance
                pass  # The serializer will use the existing value
        
        print("\n=== After validation ===")
        print(f"Returning data with mfbr_number: {data.get('mfbr_number', 'NOT FOUND')}")
        print("========================\n")
        return data


class MunicipalityBoundarySerializer(serializers.ModelSerializer):
    class Meta:
        model = MunicipalityBoundary
        fields = "__all__"

# Land boundaries serializer
class LandBoundarySerializer(serializers.ModelSerializer):
    class Meta:
        model = LandBoundary
        fields = "__all__"
            
class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)  # or use PrimaryKeyRelatedField if you want the ID

    class Meta:
        model = ActivityLog
        fields = ['logId', 'user', 'action', 'description', 'user_role', 'timestamp']
        read_only_fields = ['logId', 'user', 'timestamp']

class GPSDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GpsData
        fields = ['latitude', 'longitude']


class DeviceTokenSerializer(serializers.ModelSerializer):
    masked_token = serializers.SerializerMethodField(read_only=True)
    tracker_id = serializers.CharField(source='tracker.BirukBilugID', read_only=True)
    tracker = serializers.CharField(write_only=True, required=False, allow_blank=True)  # BirukBilugID
    is_idle = serializers.ReadOnlyField()  # Computed property from model
    has_active_violation = serializers.ReadOnlyField()  # Computed property for wave animation

    class Meta:
        model = DeviceToken
        fields = ['id', 'name', 'token', 'masked_token', 'boat_id', 'tracker', 'tracker_id', 'is_active', 'created_at', 'last_seen_at', 'is_idle', 'has_active_violation']
        read_only_fields = ['id', 'created_at', 'last_seen_at', 'tracker_id', 'is_idle', 'has_active_violation']
        extra_kwargs = {
            'token': {'write_only': True, 'required': False},  # auto-generated if not supplied
        }

    def get_masked_token(self, obj):
        if not obj.token:
            return ''
        t = obj.token
        if len(t) <= 10:
            return t
        return f"{t[:6]}…{t[-4:]}"

    def create(self, validated_data):
        tracker_bbgid = validated_data.pop('tracker', None)
        inst = DeviceToken.objects.create(**validated_data)
        # Auto-bind to tracker if provided or name matches
        from .models import BirukbilugTracker
        try:
            candidate_id = tracker_bbgid or validated_data.get('name')
            if candidate_id:
                tr = BirukbilugTracker.objects.filter(BirukBilugID=candidate_id).first()
                if tr:
                    inst.tracker = tr
                    inst.save(update_fields=['tracker'])
        except Exception:
            pass
        return inst


class BoundaryViolationNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoundaryViolationNotification
        fields = [
            'id', 'boundary_crossing', 'boat', 'fisherfolk',
            'boat_name', 'mfbr_number', 'tracker_number',
            'from_municipality', 'to_municipality', 'violation_timestamp',
            'current_lat', 'current_lng', 'dwell_duration',
            'status', 'created_at', 'read_at', 'read_by',
            # Expose status + remarks so all roles see latest edit
            'report_status', 'remarks', 'status_updated_at',
            # Useful meta already on model
            'timestamp_start', 'timestamp_end', 'idle_minutes',
            'owner_name', 'registration_number'
        ]
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Add formatted duration
        representation['dwell_duration_minutes'] = instance.dwell_duration // 60
        # Add fisherfolk name if available
        if instance.fisherfolk:
            representation['fisherfolk_name'] = f"{instance.fisherfolk.first_name} {instance.fisherfolk.last_name}"
        return representation


# Municipality Management Serializers
class BarangaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Barangay
        fields = ['barangay_id', 'name', 'municipality', 'created_at', 'updated_at']
        read_only_fields = ['barangay_id', 'created_at', 'updated_at']


class MunicipalitySerializer(serializers.ModelSerializer):
    barangays = BarangaySerializer(many=True, read_only=True)
    barangay_count = serializers.SerializerMethodField()
    is_coastal = serializers.BooleanField(required=False)
    
    class Meta:
        model = Municipality
        fields = ['municipality_id', 'name', 'prefix', 'color', 'identifier_icon', 'is_active', 'barangays', 'barangay_count', 'is_coastal', 'created_at', 'updated_at']
        read_only_fields = ['municipality_id', 'prefix', 'created_at', 'updated_at']
    
    def get_barangay_count(self, obj):
        return obj.barangays.count()
    
    def get_is_coastal(self, obj):
        return getattr(obj, 'is_coastal', False)
    
    def validate_name(self, value):
        # Check for duplicate names (case-insensitive)
        name = value.strip().title()
        query = Municipality.objects.filter(name__iexact=name)
        
        # Exclude current instance during update
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        
        if query.exists():
            raise serializers.ValidationError("A municipality with this name already exists.")
        
        return name
    
    def validate_color(self, value):
        # Validate hex color format
        if not value:
            return '#3B82F6'  # Default color
        
        value = value.strip().upper()
        
        # Ensure it starts with #
        if not value.startswith('#'):
            value = '#' + value
        
        # Validate hex format (#RRGGBB)
        if not re.match(r'^#[0-9A-F]{6}$', value):
            raise serializers.ValidationError("Color must be in hex format (e.g., #3B82F6)")
        
        return value


# Barangay Verifier Serializer
class BarangayVerifierSerializer(serializers.ModelSerializer):
    municipality_name = serializers.CharField(source='municipality.name', read_only=True)
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    municipality_id = serializers.IntegerField(source='municipality.municipality_id', read_only=True)
    barangay_id = serializers.IntegerField(source='barangay.barangay_id', read_only=True)
    
    class Meta:
        model = BarangayVerifier
        fields = ['id', 'municipality', 'municipality_id', 'municipality_name', 'barangay', 'barangay_id', 'barangay_name', 
                  'position', 'first_name', 'middle_name', 'last_name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        """Enforce only ONE active verifier per barangay+position.

        Inactive verifiers are allowed for logging/history, but if is_active is
        true we must ensure no other active verifier exists for the same
        barangay and position.
        """
        instance = getattr(self, 'instance', None)

        municipality = attrs.get('municipality') or getattr(instance, 'municipality', None)
        barangay = attrs.get('barangay') or getattr(instance, 'barangay', None)
        position = attrs.get('position') or getattr(instance, 'position', None)

        # Determine resulting active flag after this save
        is_active = attrs.get('is_active')
        if is_active is None and instance is not None:
            is_active = instance.is_active

        if barangay and position and is_active:
            qs = BarangayVerifier.objects.filter(barangay=barangay, position=position, is_active=True)
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError({
                    'position': 'This position is already assigned to an active verifier for this barangay.'
                })

        return attrs


# Signatory Serializer
class SignatorySerializer(serializers.ModelSerializer):
    municipality_name = serializers.CharField(source='municipality.name', read_only=True)
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    municipality_id = serializers.IntegerField(source='municipality.municipality_id', read_only=True)
    barangay_id = serializers.IntegerField(source='barangay.barangay_id', read_only=True)
    # Make FK inputs optional/nullable for create/update
    municipality = serializers.PrimaryKeyRelatedField(queryset=Municipality.objects.all(), required=False, allow_null=True)
    barangay = serializers.PrimaryKeyRelatedField(queryset=Barangay.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = Signatory
        fields = ['id', 'municipality', 'municipality_id', 'municipality_name', 'barangay', 'barangay_id', 'barangay_name',
                  'position', 'first_name', 'middle_name', 'last_name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        position = data.get('position') or (self.instance.position if self.instance else None)
        municipality = data.get('municipality') if 'municipality' in data else (self.instance.municipality if self.instance else None)
        barangay = data.get('barangay') if 'barangay' in data else (self.instance.barangay if self.instance else None)

        municipal_positions = ['Municipal Agriculturist', 'Municipal Fishery Coordinator', 'Mayor']

        # Conditional requirements by scope
        if position == 'Provincial Agriculturist':
            if municipality is not None or barangay is not None:
                raise serializers.ValidationError({'detail': 'Provincial positions must not be assigned to a municipality or barangay.'})
        elif position in municipal_positions:
            if municipality is None:
                raise serializers.ValidationError({'municipality': 'This field is required for municipal positions.'})
            if barangay is not None:
                raise serializers.ValidationError({'barangay': 'Do not set barangay for municipal positions.'})
        else:
            # Default to barangay-level
            if municipality is None or barangay is None:
                raise serializers.ValidationError({'barangay': 'Municipality and barangay are required for this position.'})

        # Global uniqueness: Provincial Agriculturist
        if position == 'Provincial Agriculturist':
            qs = Signatory.objects.all()
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.filter(position='Provincial Agriculturist').exists():
                raise serializers.ValidationError({'position': 'Only one Provincial Agriculturist is allowed for the entire province.'})

        # Municipality-level uniqueness: MA, MFC, Mayor
        if position in municipal_positions and municipality is not None:
            qs = Signatory.objects.filter(municipality=municipality, position=position)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'position': f'Only one {position} is allowed per municipality.'})
        return data
