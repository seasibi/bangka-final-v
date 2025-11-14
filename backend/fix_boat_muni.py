import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Boat

# Update boat municipality
boat = Boat.objects.filter(mfbr_number='LU-SJN-111').first()
if boat:
    print(f"Current registered_municipality: {boat.registered_municipality}")
    boat.registered_municipality = "San Juan"
    boat.save()
    print(f"✅ Updated to: {boat.registered_municipality}")
else:
    print("❌ Boat not found")
