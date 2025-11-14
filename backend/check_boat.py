import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Boat, BirukbilugTracker

# Check boat
boat = Boat.objects.filter(mfbr_number='LU-SJN-111').first()
if boat:
    print(f"✅ Boat Found:")
    print(f"  MFBR: {boat.mfbr_number}")
    print(f"  Boat Name: {boat.boat_name}")
    print(f"  Registered Municipality: {boat.registered_municipality}")
    print(f"  Boat ID: {boat.boat_id}")
    if hasattr(boat, 'fisherfolk_registration_number') and boat.fisherfolk_registration_number:
        ff = boat.fisherfolk_registration_number
        print(f"  Fisherfolk: {ff.first_name} {ff.last_name}")
        if hasattr(ff, 'address') and ff.address:
            print(f"  Fisherfolk Municipality: {ff.address.municipality}")
else:
    print("❌ Boat NOT FOUND")

# Check tracker
print("\n--- Tracker Info ---")
tracker = BirukbilugTracker.objects.filter(boat__mfbr_number='LU-SJN-111').first()
if tracker:
    print(f"  Tracker ID: {tracker.BirukBilugID}")
    print(f"  Municipality: {tracker.municipality}")
else:
    print("  No tracker linked")
