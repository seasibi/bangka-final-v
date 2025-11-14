from django.core.management.base import BaseCommand
from api.models import DeviceToken, BirukbilugTracker

class Command(BaseCommand):
    help = 'Revert device token back to original ESP32 token'

    def handle(self, *args, **options):
        # The ACTUAL token that's in your ESP32 code
        CORRECT_TOKEN = "6841391315bfc232be8ebf77d9ed4675c73a1d39230afad9c118abbbea39b756"
        
        self.stdout.write("=" * 80)
        self.stdout.write("REVERTING TO CORRECT ESP32 TOKEN")
        self.stdout.write("=" * 80)
        
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
            device = DeviceToken.objects.get(tracker=tracker)
            
            self.stdout.write(f"\n✓ Found device token for {tracker.BirukBilugID}")
            self.stdout.write(f"  Current token: {device.token[:20]}...")
            
            # Revert to correct token
            device.token = CORRECT_TOKEN
            device.is_active = True
            device.save()
            
            self.stdout.write(self.style.SUCCESS(f"\n✓ TOKEN REVERTED TO ESP32 VALUE!"))
            self.stdout.write(f"  Correct token: {CORRECT_TOKEN[:20]}...")
            self.stdout.write("\n" + "=" * 80)
            self.stdout.write(self.style.SUCCESS("✓ ESP32 SHOULD NOW WORK!"))
            self.stdout.write("=" * 80)
            self.stdout.write(f"\nYour ESP32 will now successfully authenticate.")
            self.stdout.write(f"Watch for violations after 15 minutes in San Gabriel\n")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n✗ Error: {e}"))
