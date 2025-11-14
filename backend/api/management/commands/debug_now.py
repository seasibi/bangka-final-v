from django.core.management.base import BaseCommand
from api.models import *
from api.boundary_service import boundary_service, check_and_notify_boundary_crossing
from django.utils import timezone
from datetime import timedelta

class Command(BaseCommand):
    help = 'Debug current state'

    def handle(self, *args, **options):
        self.stdout.write("=" * 80)
        self.stdout.write("DEBUGGING CURRENT STATE")
        self.stdout.write("=" * 80)
        
        # 1. Check ALL crossings in database
        self.stdout.write("\n1. ALL CROSSINGS IN DATABASE:")
        all_crossings = BoundaryCrossing.objects.all()
        for c in all_crossings:
            age = timezone.now() - c.crossing_timestamp
            self.stdout.write(f"\n  ID: {c.id}")
            self.stdout.write(f"  boat_id: {c.boat_id}")
            self.stdout.write(f"  Route: {c.from_municipality} → {c.to_municipality}")
            self.stdout.write(f"  SMS Sent: {c.sms_sent}")
            self.stdout.write(f"  Age: {int(age.total_seconds()/60)} minutes")
        
        if not all_crossings.exists():
            self.stdout.write("  ❌ NO CROSSINGS FOUND!")
        
        # 2. Check latest GPS
        self.stdout.write("\n\n2. LATEST GPS DATA:")
        latest = GpsData.objects.filter(mfbr_number="4567889").order_by('-timestamp').first()
        if latest:
            self.stdout.write(f"  MFBR: {latest.mfbr_number}")
            self.stdout.write(f"  Coords: ({latest.latitude:.6f}, {latest.longitude:.6f})")
            self.stdout.write(f"  Time: {latest.timestamp}")
            muni = boundary_service.get_municipality_at_point(latest.latitude, latest.longitude)
            self.stdout.write(f"  Municipality: {muni}")
        
        # 3. MANUALLY run boundary check
        self.stdout.write("\n\n3. MANUAL BOUNDARY CHECK:")
        self.stdout.write("  Running check_and_notify_boundary_crossing...")
        
        if latest:
            result = check_and_notify_boundary_crossing(
                boat_id=0,
                latitude=latest.latitude,
                longitude=latest.longitude,
                mfbr_number="4567889",
                home_municipality="San Juan",
                tracker_id="SJU-0001"
            )
            
            self.stdout.write(f"\n  Result:")
            self.stdout.write(f"    crossing_detected: {result.get('crossing_detected', False)}")
            self.stdout.write(f"    pending: {result.get('pending', False)}")
            self.stdout.write(f"    dwell_alert_sent: {result.get('dwell_alert_sent', False)}")
            self.stdout.write(f"    beep: {result.get('beep', False)}")
            
            if not result.get('dwell_alert_sent'):
                self.stdout.write("\n  ❌ VIOLATION NOT TRIGGERED!")
                
                # Check why
                self.stdout.write("\n  Checking why...")
                
                # Check pending crossings query
                self.stdout.write("\n  Checking for boat_id=0 crossings...")
                pending = BoundaryCrossing.objects.filter(
                    boat_id=0,
                    sms_sent=False
                )
                self.stdout.write(f"    Found {pending.count()} pending crossings with boat_id=0")
                
                # Check if any have GPS data for this MFBR
                for p in pending:
                    has_gps = GpsData.objects.filter(
                        mfbr_number="4567889",
                        timestamp__gte=p.crossing_timestamp
                    ).exists()
                    self.stdout.write(f"    Crossing {p.id}: has GPS for MFBR 4567889: {has_gps}")
                
        # 4. Check settings
        self.stdout.write("\n\n4. SETTINGS:")
        from django.conf import settings
        dwell = getattr(settings, 'BOUNDARY_DWELL_MINUTES', 15)
        self.stdout.write(f"  BOUNDARY_DWELL_MINUTES: {dwell}")
        
        self.stdout.write("\n" + "=" * 80)