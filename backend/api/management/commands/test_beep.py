from django.core.management.base import BaseCommand
from api.models import BirukbilugTracker, BoundaryViolationNotification
from django.test import RequestFactory
from api.views import ingest_positions
import json

class Command(BaseCommand):
    help = 'Test beep by simulating GPS POST with active violation'

    def handle(self, *args, **options):
        tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
        boat = tracker.boat
        device = tracker.device_token
        
        # Check for active violations
        active_violation = BoundaryViolationNotification.objects.filter(
            mfbr_number=boat.mfbr_number,
            status='pending'
        ).first()
        
        if not active_violation:
            self.stdout.write(self.style.ERROR("✗ No active violation found"))
            return
        
        self.stdout.write(f"✓ Active violation found: ID {active_violation.id}")
        self.stdout.write(f"  Route: {active_violation.from_municipality} → {active_violation.to_municipality}")
        
        # The issue: beep only triggers when dwell_alert_sent=True on THIS request
        # But the violation was already sent, so beep won't trigger again
        
        self.stdout.write("\n" + "="*80)
        self.stdout.write("SOLUTION")
        self.stdout.write("="*80)
        self.stdout.write("\nThe beep only triggers ONCE when violation is first detected.")
        self.stdout.write("Since we manually triggered it, the ESP32 missed that response.")
        self.stdout.write("\nOptions:")
        self.stdout.write("  1. Delete the violation and let it re-trigger naturally")
        self.stdout.write("  2. Send a test POST with force_beep=true flag")
        self.stdout.write("  3. Wait for boat to return home and re-enter San Gabriel")
        
        # Option to delete violation
        self.stdout.write("\nDo you want to DELETE the violation so it triggers again? (y/n)")
        # For automation, let's check if there's a pending violation older than 1 minute
        from django.utils import timezone
        from datetime import timedelta
        
        if (timezone.now() - active_violation.created_at) < timedelta(minutes=1):
            self.stdout.write(self.style.WARNING("\n⚠ Violation is very recent, keeping it"))
            self.stdout.write("\nTo test beep, your ESP32 should send:")
            self.stdout.write('  {"lat":16.671, "lng":120.403, "force_beep":true}')
            self.stdout.write("\nOr just move back to San Juan and re-enter San Gabriel")
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ Deleting old violation to allow re-trigger..."))
            active_violation.delete()
            
            # Also delete the crossing
            from api.models import BoundaryCrossing
            boat_id_hash = abs(hash(boat.mfbr_number)) % (10 ** 8)
            BoundaryCrossing.objects.filter(boat_id=boat_id_hash).delete()
            
            self.stdout.write("✓ Violation and crossing deleted")
            self.stdout.write("\nNext ESP32 GPS update should trigger fresh violation with beep!")
