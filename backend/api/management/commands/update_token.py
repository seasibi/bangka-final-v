from django.core.management.base import BaseCommand
from api.models import DeviceToken, BirukbilugTracker
from django.utils import timezone

class Command(BaseCommand):
    help = 'Update the device token for SJU-0001 tracker'

    def handle(self, *args, **options):
        NEW_TOKEN = "9a7c1d9135d9aca096cca48a8e9bd546dd356e65d5f95da4da4aa831afcf9f73"
        
        self.stdout.write("=" * 80)
        self.stdout.write("UPDATING DEVICE TOKEN FOR SJU-0001")
        self.stdout.write("=" * 80)
        
        # Find the SJU-0001 tracker
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
            self.stdout.write(self.style.SUCCESS(f"\n✓ Found tracker: SJU-0001"))
            self.stdout.write(f"  Municipality: {tracker.municipality}")
            if tracker.boat:
                self.stdout.write(f"  Boat: {tracker.boat.mfbr_number}")
                self.stdout.write(f"  Registered: {tracker.boat.registered_municipality}")
        except BirukbilugTracker.DoesNotExist:
            self.stdout.write(self.style.ERROR("✗ Tracker SJU-0001 not found!"))
            return
        
        # Find existing device token for this tracker
        try:
            device = DeviceToken.objects.get(tracker=tracker)
            old_token = device.token[:20] + "..."
            self.stdout.write(f"\n✓ Found existing device token")
            self.stdout.write(f"  Old token: {old_token}")
            
            # Update with new token
            device.token = NEW_TOKEN
            device.is_active = True
            device.last_seen_at = timezone.now()
            device.save()
            
            self.stdout.write(self.style.SUCCESS(f"\n✓ TOKEN UPDATED!"))
            self.stdout.write(f"  New token: {NEW_TOKEN[:20]}...")
            
        except DeviceToken.DoesNotExist:
            # Create new token
            device = DeviceToken.objects.create(
                name=f"ESP32-{tracker.BirukBilugID}",
                token=NEW_TOKEN,
                tracker=tracker,
                is_active=True,
                last_seen_at=timezone.now()
            )
            self.stdout.write(self.style.SUCCESS(f"\n✓ DEVICE TOKEN CREATED!"))
        
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.SUCCESS("✓ READY TO TEST!"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"\nYour ESP32 should now be able to send GPS data.")
        self.stdout.write(f"Expected: Boat in San Gabriel → Violation (not in San Juan)")
        self.stdout.write(f"Wait 15 minutes for SMS/Buzzer/Notification\n")
