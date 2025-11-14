import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Boat, Municipality

# Test the boat from the screenshot
mfbr = "LU-CSF-123"
print(f"Testing boat: {mfbr}")
print("=" * 50)

boat = Boat.objects.filter(mfbr_number=mfbr).first()
if boat:
    print(f"Boat found: {boat.boat_name}")
    print(f"Registered Municipality: {boat.registered_municipality}")
    
    # Check municipality identifier_icon
    if boat.registered_municipality:
        muni = Municipality.objects.filter(name=boat.registered_municipality).first()
        if muni:
            print(f"Municipality found: {muni.name}")
            print(f"Municipality color: {muni.color}")
            print(f"Municipality identifier_icon: {muni.identifier_icon}")
        else:
            print(f"❌ Municipality '{boat.registered_municipality}' not found in database!")
    else:
        print("❌ Boat has no registered_municipality!")
else:
    print(f"❌ Boat with MFBR {mfbr} not found!")

print("=" * 50)
