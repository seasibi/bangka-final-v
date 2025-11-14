from django.core.management.base import BaseCommand
from api.models import DeviceToken, BirukbilugTracker, Boat
from django.utils import timezone

class Command(BaseCommand):
    help = 'Fix device token and tracker configuration for SGB-0001'

    def handle(self, *args, **options):
        ESP32_TOKEN = "9a7c1d9135d9aca096cca48a8e9bd546dd356e65d5f95da4da4aa831afcf9f73"
        
        self.stdout.write("=" * 80)
        self.stdout.write("FIXING DEVICE TOKEN FOR SGB-0001")
        self.stdout.write("=" * 80)
        
        # Step 1: Create or get tracker
        self.stdout.write("\n1. Setting up tracker SGB-0001...")
        tracker, created = BirukbilugTracker.objects.get_or_create(
            BirukBilugID="SGB-0001",
            defaults={
                'municipality': 'San Juan',  # Registered municipality
                'status': 'available'
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS("   ✓ Created tracker SGB-0001"))
        else:
            self.stdout.write(self.style.SUCCESS("   ✓ Tracker exists"))
        
        # Step 2: Find Sandric's boat
        self.stdout.write("\n2. Finding Sandric's boat...")
        boat = Boat.objects.filter(
            fisherfolk_registration_number__first_name__icontains="Sandric"
        ).first()
        
        if not boat:
            self.stdout.write(self.style.ERROR("   ✗ Boat not found!"))
            return
        
        self.stdout.write(self.style.SUCCESS(f"   ✓ Found boat: {boat.mfbr_number}"))
        
        # Step 3: Set boat municipality if needed
        if boat.registered_municipality != "San Juan":
            self.stdout.write("\n3. Setting boat municipality to San Juan...")
            boat.registered_municipality = "San Juan"
            boat.save()
            self.stdout.write(self.style.SUCCESS("   ✓ Updated"))
        
        # Step 4: Link tracker to boat (check if already linked)
        self.stdout.write("\n4. Checking tracker-boat link...")
        if tracker.boat and tracker.boat.mfbr_number == boat.mfbr_number:
            self.stdout.write(self.style.SUCCESS("   ✓ Already linked"))
        else:
            # Check if boat is already linked to another tracker
            existing_tracker = BirukbilugTracker.objects.filter(boat=boat).exclude(BirukBilugID="SGB-0001").first()
            if existing_tracker:
                self.stdout.write(self.style.WARNING(f"   ! Boat already linked to {existing_tracker.BirukBilugID}"))
                self.stdout.write(f"   Using existing tracker: {existing_tracker.BirukBilugID}")
                tracker = existing_tracker
            else:
                tracker.boat = boat
                tracker.status = 'in_use'
                tracker.save()
                self.stdout.write(self.style.SUCCESS("   ✓ Linked"))
        
        # Step 5: Create device token
        self.stdout.write("\n5. Creating device token...")
        device, created = DeviceToken.objects.get_or_create(
            token=ESP32_TOKEN,
            defaults={
                'name': 'ESP32-SGB-0001',
                'tracker': tracker,
                'boat_id': 0,
                'is_active': True,
                'last_seen_at': timezone.now()
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS("   ✓ Created device token"))
        else:
            device.tracker = tracker
            device.is_active = True
            device.save()
            self.stdout.write(self.style.SUCCESS("   ✓ Updated device token"))
        
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("✓ CONFIGURATION COMPLETE!"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"\nBoat: {boat.mfbr_number} (Registered: San Juan)")
        self.stdout.write(f"Owner: {boat.fisherfolk_registration_number.first_name}")
        self.stdout.write(f"Current location: San Gabriel → SHOULD TRIGGER VIOLATION")
        self.stdout.write(f"\nWait 15 minutes for notification to trigger")
