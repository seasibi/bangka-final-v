from django.core.management.base import BaseCommand
from api.models import BirukbilugTracker, BoundaryCrossing, BoundaryViolationNotification, GpsData
from api.boundary_service import check_and_notify_boundary_crossing
from django.utils import timezone

class Command(BaseCommand):
    help = 'Check crossing status and manually trigger if needed'

    def handle(self, *args, **options):
        self.stdout.write("=" * 80)
        self.stdout.write("CHECKING CROSSING STATUS")
        self.stdout.write("=" * 80)
        
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
            boat = tracker.boat
            mfbr = boat.mfbr_number
            boat_id_hash = abs(hash(mfbr)) % (10 ** 8)
            
            # Check the crossing
            crossing = BoundaryCrossing.objects.filter(
                boat_id=boat_id_hash
            ).order_by('-crossing_timestamp').first()
            
            if not crossing:
                self.stdout.write(self.style.ERROR("✗ No crossing found!"))
                return
            
            age = timezone.now() - crossing.crossing_timestamp
            age_min = int(age.total_seconds() / 60)
            
            self.stdout.write(f"\nCrossing ID: {crossing.id}")
            self.stdout.write(f"Route: {crossing.from_municipality} → {crossing.to_municipality}")
            self.stdout.write(f"Timestamp: {crossing.crossing_timestamp}")
            self.stdout.write(f"Age: {age_min} minutes")
            self.stdout.write(f"SMS Sent: {crossing.sms_sent}")
            self.stdout.write(f"SMS Response: {crossing.sms_response}")
            
            # Check violations
            violations = BoundaryViolationNotification.objects.filter(
                mfbr_number=mfbr
            ).order_by('-created_at')
            
            self.stdout.write(f"\nViolation Notifications: {violations.count()}")
            for v in violations:
                self.stdout.write(f"  - ID: {v.id}, Status: {v.status}, Created: {v.created_at}")
            
            if crossing.sms_sent:
                self.stdout.write(self.style.WARNING("\n⚠ Crossing already marked as sent!"))
                self.stdout.write("Response was:")
                self.stdout.write(str(crossing.sms_response))
                return
            
            # Get latest GPS
            latest_gps = GpsData.objects.filter(
                mfbr_number=mfbr
            ).order_by('-timestamp').first()
            
            if not latest_gps:
                self.stdout.write(self.style.ERROR("\n✗ No GPS data found"))
                return
            
            self.stdout.write(f"\nLatest GPS:")
            self.stdout.write(f"  Coords: ({latest_gps.latitude:.6f}, {latest_gps.longitude:.6f})")
            self.stdout.write(f"  Time: {latest_gps.timestamp}")
            
            # MANUALLY TRIGGER THE BOUNDARY CHECK
            self.stdout.write("\n" + "=" * 80)
            self.stdout.write("MANUALLY TRIGGERING BOUNDARY CHECK...")
            self.stdout.write("=" * 80 + "\n")
            
            result = check_and_notify_boundary_crossing(
                boat_id=0,
                latitude=latest_gps.latitude,
                longitude=latest_gps.longitude,
                mfbr_number=mfbr,
                home_municipality=boat.registered_municipality,
                tracker_id=tracker.BirukBilugID
            )
            
            self.stdout.write("\nResult from boundary check:")
            self.stdout.write(str(result))
            
            if result and result.get('dwell_alert_sent'):
                self.stdout.write(self.style.SUCCESS("\n✓ VIOLATION TRIGGERED!"))
                self.stdout.write(f"  Beep: {result.get('beep', False)}")
                self.stdout.write(f"  UI Notification: {result.get('ui_notification_created', False)}")
            else:
                self.stdout.write(self.style.ERROR("\n✗ Violation NOT triggered"))
                self.stdout.write("  Checking why...")
                
                # Refresh crossing
                crossing.refresh_from_db()
                self.stdout.write(f"\n  Crossing SMS sent: {crossing.sms_sent}")
                self.stdout.write(f"  Crossing response: {crossing.sms_response}")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n✗ Error: {e}"))
            import traceback
            traceback.print_exc()
