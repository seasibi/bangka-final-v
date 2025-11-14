from django.core.management.base import BaseCommand
from api.models import *
from api.boundary_service import boundary_service
from django.utils import timezone
from datetime import timedelta
from django.conf import settings

class Command(BaseCommand):
    help = 'Complete system verification and fix'

    def handle(self, *args, **options):
        self.stdout.write("=" * 100)
        self.stdout.write("COMPLETE SYSTEM VERIFICATION & FIX")
        self.stdout.write("=" * 100)
        
        # 1. Change dwell time to 1 minute for testing
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("1. SETTING DWELL TIME TO 1 MINUTE FOR TESTING")
        self.stdout.write("=" * 100)
        
        # Check current setting
        from api import boundary_service as bs_module
        current_dwell = getattr(bs_module, '_DWELL_MINUTES', 15)
        self.stdout.write(f"Current dwell time: {current_dwell} minutes")
        
        # IMPORTANT: We need to edit the settings
        self.stdout.write("\n⚠️  To change dwell time, edit backend/backend/settings.py:")
        self.stdout.write("    Add: BOUNDARY_DWELL_MINUTES = 1")
        self.stdout.write("    Then restart Django server")
        
        # 2. Clear old violations and crossings
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("2. CLEARING OLD VIOLATIONS & CROSSINGS")
        self.stdout.write("=" * 100)
        
        old_violations = BoundaryViolationNotification.objects.all().count()
        old_crossings = BoundaryCrossing.objects.all().count()
        
        self.stdout.write(f"Found {old_violations} violations and {old_crossings} crossings")
        
        if old_violations > 0 or old_crossings > 0:
            BoundaryViolationNotification.objects.all().delete()
            BoundaryCrossing.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("✓ Cleared all old data"))
        
        # 3. Verify tracker and boat setup
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("3. VERIFYING TRACKER & BOAT SETUP")
        self.stdout.write("=" * 100)
        
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
            boat = tracker.boat
            
            self.stdout.write(f"✓ Tracker: {tracker.BirukBilugID}")
            self.stdout.write(f"  Municipality: {tracker.municipality}")
            
            if not boat:
                self.stdout.write(self.style.ERROR("✗ No boat linked!"))
                return
            
            self.stdout.write(f"\n✓ Boat: {boat.mfbr_number} - {boat.boat_name}")
            self.stdout.write(f"  Registered Municipality: {boat.registered_municipality}")
            
            if boat.registered_municipality != "San Juan":
                self.stdout.write(self.style.WARNING("⚠️  Setting boat municipality to San Juan..."))
                boat.registered_municipality = "San Juan"
                boat.save()
                self.stdout.write(self.style.SUCCESS("✓ Fixed!"))
            
            if boat.fisherfolk_registration_number:
                ff = boat.fisherfolk_registration_number
                self.stdout.write(f"\n✓ Fisherfolk: {ff.first_name} {ff.last_name}")
                self.stdout.write(f"  Contact: {ff.contact_number}")
                if ff.address:
                    self.stdout.write(f"  Home Municipality: {ff.address.municipality}")
                    if ff.address.municipality != "San Juan":
                        self.stdout.write(self.style.WARNING("  ⚠️  Fisherfolk address is not San Juan!"))
            
        except BirukbilugTracker.DoesNotExist:
            self.stdout.write(self.style.ERROR("✗ Tracker SJU-0001 not found!"))
            return
        
        # 4. Test GPS coordinates
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("4. TESTING GPS COORDINATES")
        self.stdout.write("=" * 100)
        
        latest_gps = GpsData.objects.filter(mfbr_number=boat.mfbr_number).order_by('-timestamp').first()
        
        if not latest_gps:
            self.stdout.write(self.style.ERROR("✗ No GPS data found!"))
            self.stdout.write("  ESP32 is not sending data. Check:")
            self.stdout.write("    1. Device token is correct")
            self.stdout.write("    2. ESP32 has internet connection")
            self.stdout.write("    3. Ngrok is running")
            return
        
        lat, lng = latest_gps.latitude, latest_gps.longitude
        current_muni = boundary_service.get_municipality_at_point(lat, lng)
        
        self.stdout.write(f"\nLatest GPS: ({lat:.6f}, {lng:.6f})")
        self.stdout.write(f"Detected Municipality: {current_muni or 'NOT IN ANY BOUNDARY'}")
        self.stdout.write(f"Registered Municipality: {boat.registered_municipality}")
        
        if not current_muni:
            self.stdout.write(self.style.ERROR("\n✗ GPS COORDINATES NOT IN ANY BOUNDARY!"))
            self.stdout.write("  This is the root cause!")
            self.stdout.write("\n  Checking all boundaries...")
            
            boundaries = MunicipalityBoundary.objects.all()
            self.stdout.write(f"\n  Database has {boundaries.count()} boundaries:")
            for b in boundaries:
                self.stdout.write(f"    - {b.name}")
            
            self.stdout.write(f"\n  Loaded in service: {len(boundary_service.municipal_polygons)} polygons")
            
            # Test nearby municipalities
            self.stdout.write("\n  Testing nearby coordinates:")
            test_points = [
                (16.65, 120.40, "South of current"),
                (16.70, 120.40, "North of current"),
                (16.671, 120.35, "West of current"),
                (16.671, 120.45, "East of current"),
            ]
            for test_lat, test_lng, desc in test_points:
                test_muni = boundary_service.get_municipality_at_point(test_lat, test_lng)
                result = test_muni if test_muni else "❌ NOT FOUND"
                self.stdout.write(f"    ({test_lat:.6f}, {test_lng:.6f}) - {desc}: {result}")
            
            return
        
        # 5. Check if violation should exist
        if current_muni != boat.registered_municipality:
            self.stdout.write(self.style.ERROR(f"\n✗ VIOLATION! Boat in {current_muni}, should be in {boat.registered_municipality}"))
            
            age = timezone.now() - latest_gps.timestamp
            age_min = int(age.total_seconds() / 60)
            
            self.stdout.write(f"  Time in {current_muni}: {age_min} minutes")
            
            if age_min >= 1:  # Using 1 minute for testing
                self.stdout.write(self.style.ERROR("  ⚠️  Violation SHOULD HAVE TRIGGERED!"))
            else:
                self.stdout.write(f"  ⏱  Wait {1 - age_min} more minute(s)")
        else:
            self.stdout.write(self.style.SUCCESS(f"\n✓ Boat is in HOME waters ({current_muni})"))
            self.stdout.write("  No violation expected")
        
        # 6. Check boundary crossing logic
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("6. TESTING BOUNDARY CROSSING DETECTION")
        self.stdout.write("=" * 100)
        
        # Get last 2 GPS points
        gps_points = list(GpsData.objects.filter(
            mfbr_number=boat.mfbr_number
        ).order_by('-timestamp')[:2])
        
        if len(gps_points) < 2:
            self.stdout.write(self.style.WARNING("⚠️  Need at least 2 GPS points to detect crossing"))
            self.stdout.write("  System will detect crossing on next GPS update")
        else:
            current_point = gps_points[0]
            previous_point = gps_points[1]
            
            current_m = boundary_service.get_municipality_at_point(current_point.latitude, current_point.longitude)
            previous_m = boundary_service.get_municipality_at_point(previous_point.latitude, previous_point.longitude)
            
            self.stdout.write(f"\nPrevious: {previous_m} at {previous_point.timestamp.strftime('%H:%M:%S')}")
            self.stdout.write(f"Current:  {current_m} at {current_point.timestamp.strftime('%H:%M:%S')}")
            
            if current_m != previous_m:
                self.stdout.write(self.style.SUCCESS(f"\n✓ CROSSING DETECTED: {previous_m} → {current_m}"))
            else:
                self.stdout.write(f"\n  No crossing detected (stayed in {current_m})")
        
        # 7. Final recommendations
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("7. ACTION ITEMS")
        self.stdout.write("=" * 100)
        
        action_items = []
        
        # Check dwell time setting
        self.stdout.write("\n1. SET DWELL TIME TO 1 MINUTE:")
        self.stdout.write("   Edit: backend/backend/settings.py")
        self.stdout.write("   Add this line at the end:")
        self.stdout.write("   BOUNDARY_DWELL_MINUTES = 1")
        self.stdout.write("   Then restart Django: Ctrl+C and run again")
        
        if not current_muni:
            self.stdout.write("\n2. FIX BOUNDARY POLYGONS:")
            self.stdout.write("   Your GPS coordinates are NOT inside any polygon")
            self.stdout.write("   Check your MunicipalityBoundary data in database")
        
        self.stdout.write("\n3. TEST SEQUENCE:")
        self.stdout.write("   a) Restart Django server (to apply 1-minute dwell)")
        self.stdout.write("   b) Make sure you're in San Gabriel (not San Juan)")
        self.stdout.write("   c) Wait for 2 GPS updates (16 seconds)")
        self.stdout.write("   d) After 1 minute in San Gabriel, violation should trigger")
        self.stdout.write("   e) Check ESP32 serial for 'beep:true' in response")
        
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("VERIFICATION COMPLETE")
        self.stdout.write("=" * 100 + "\n")
