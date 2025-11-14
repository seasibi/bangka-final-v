import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Boat

print("Fixing municipality name mismatches...")
print("=" * 50)

# Fix City Of San Fernando -> San Fernando
old_name = "City Of San Fernando"
new_name = "San Fernando"

boats_to_fix = Boat.objects.filter(registered_municipality=old_name)
count = boats_to_fix.count()

if count > 0:
    print(f"Found {count} boats with old municipality name: '{old_name}'")
    print("Updating to new name...")
    
    # Update all boats
    boats_to_fix.update(registered_municipality=new_name)
    
    print(f"✅ Successfully updated {count} boats to '{new_name}'")
    
    # Verify the fix
    boat = Boat.objects.filter(mfbr_number="LU-CSF-123").first()
    if boat:
        print(f"\nVerification - Boat LU-CSF-123:")
        print(f"  Boat name: {boat.boat_name}")
        print(f"  Registered municipality: {boat.registered_municipality}")
else:
    print(f"✅ No boats found with old municipality name '{old_name}'")

print("=" * 50)
print("Done!")
