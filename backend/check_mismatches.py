import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Boat, Municipality

# Get all municipality names from database
valid_munis = set(Municipality.objects.values_list('name', flat=True))

print("Checking for municipality name mismatches...")
print("=" * 60)

# Get unique registered municipalities from boats
boat_munis = Boat.objects.exclude(registered_municipality__isnull=True).exclude(registered_municipality='').values_list('registered_municipality', flat=True).distinct()

mismatches = []
for boat_muni in boat_munis:
    if boat_muni not in valid_munis:
        # Check for partial match
        matching = [m for m in valid_munis if m.lower() in boat_muni.lower() or boat_muni.lower() in m.lower()]
        mismatches.append({
            'boat_value': boat_muni,
            'possible_match': matching[0] if matching else None,
            'count': Boat.objects.filter(registered_municipality=boat_muni).count()
        })

if mismatches:
    print(f"Found {len(mismatches)} municipality name mismatches:\n")
    for m in mismatches:
        print(f"❌ Boats registered to: '{m['boat_value']}'")
        if m['possible_match']:
            print(f"   → Should be: '{m['possible_match']}'")
        print(f"   → Affected boats: {m['count']}")
        print()
else:
    print("✅ All boat municipalities match database!")

print("=" * 60)
print(f"\nValid municipalities in database:")
for muni in sorted(valid_munis):
    print(f"  - {muni}")
