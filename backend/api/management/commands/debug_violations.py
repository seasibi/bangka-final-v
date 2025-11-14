from django.core.management.base import BaseCommand
from api.models import DeviceToken, BirukbilugTracker, Boat, GpsData, BoundaryCrossing, BoundaryViolationNotification, MunicipalityBoundary
from api.boundary_service import boundary_service
from django.utils import timezone
from datetime import timedelta
import json

class Command(BaseCommand):
    help = 'Comprehensive diagnostic for boundary violation detection'

    def handle(self, *args, **options):
        self.stdout.write("=" * 100)
        self.stdout.write("COMPREHENSIVE BOUNDARY VIOLATION DIAGNOSTIC")
        self.stdout.write("=" * 100)
        
        # 1. Check Device Token
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("1. DEVICE TOKEN CHECK")
        self.stdout.write("=" * 100)
        
        try:
            tracker = BirukbilugTracker.objects.get(BirukBilugID="SJU-0001")
            device = DeviceToken.objects.get(tracker=tracker)
            
            self.stdout.write(self.style.SUCCESS(f"✓ Device Token: {device.name}"))
            self.stdout.write(f"  Token: {device.token[:20]}...")
            self.stdout.write(f"  Active: {device.is_active}")
            self.stdout.write(f"  Last Seen: {device.last_seen_at}")
            self.stdout.write(f"  Tracker: {tracker.BirukBilugID}")
            self.stdout.write(f"  Tracker Municipality: {tracker.municipality}")
            
            if tracker.boat:
                boat = tracker.boat
                self.stdout.write(f"\n  Boat Details:")
                self.stdout.write(f"    MFBR: {boat.mfbr_number}")
                self.stdout.write(f"    Name: {boat.boat_name}")
                self.stdout.write(f"    Registered Municipality: {boat.registered_municipality}")
                
                if boat.fisherfolk_registration_number:
                    ff = boat.fisherfolk_registration_number
                    self.stdout.write(f"\n  Fisherfolk:")
                    self.stdout.write(f"    Name: {ff.first_name} {ff.last_name}")
                    self.stdout.write(f"    Contact: {ff.contact_number}")
                    if ff.address:
                        self.stdout.write(f"    Home Municipality: {ff.address.municipality}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Error: {e}"))
            return
        
        # 2. Check Recent GPS Data
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("2. RECENT GPS DATA (Last 10 updates)")
        self.stdout.write("=" * 100)
        
        recent_gps = GpsData.objects.filter(
            mfbr_number=boat.mfbr_number
        ).order_by('-timestamp')[:10]
        
        if not recent_gps.exists():
            self.stdout.write(self.style.WARNING("⚠ No GPS data found!"))
        else:
            self.stdout.write(f"Found {recent_gps.count()} GPS updates:\n")
            for i, gps in enumerate(recent_gps, 1):
                # Check which municipality this point is in
                muni = boundary_service.get_municipality_at_point(gps.latitude, gps.longitude)
                age = timezone.now() - gps.timestamp
                age_str = f"{int(age.total_seconds() / 60)}m ago"
                
                status = "✓" if muni else "✗"
                self.stdout.write(f"  {i}. {gps.timestamp.strftime('%H:%M:%S')} ({age_str})")
                self.stdout.write(f"     Coords: ({gps.latitude:.6f}, {gps.longitude:.6f})")
                self.stdout.write(f"     Municipality: {muni or 'NOT IN ANY BOUNDARY'} {status}")
                self.stdout.write(f"     MFBR: {gps.mfbr_number}, Tracker: {gps.tracker_id}")
        
        # 3. Check Municipality Boundaries
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("3. MUNICIPALITY BOUNDARY POLYGONS")
        self.stdout.write("=" * 100)
        
        boundaries = MunicipalityBoundary.objects.all()
        self.stdout.write(f"Database has {boundaries.count()} boundaries:")
        for b in boundaries:
            loaded = "✓" if b.name in boundary_service.municipal_polygons else "✗"
            self.stdout.write(f"  {loaded} {b.name}")
        
        self.stdout.write(f"\nBoundary service loaded {len(boundary_service.municipal_polygons)} polygons")
        
        # 4. Test Current Position
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("4. CURRENT POSITION ANALYSIS")
        self.stdout.write("=" * 100)
        
        latest = GpsData.objects.order_by('-timestamp').first()
        if latest:
            lat, lng = latest.latitude, latest.longitude
            current_muni = boundary_service.get_municipality_at_point(lat, lng)
            
            self.stdout.write(f"Latest GPS: ({lat:.6f}, {lng:.6f})")
            self.stdout.write(f"Timestamp: {latest.timestamp}")
            self.stdout.write(f"Age: {int((timezone.now() - latest.timestamp).total_seconds() / 60)} minutes ago")
            self.stdout.write(f"\nCurrent Municipality: {current_muni or 'NOT IN ANY BOUNDARY'}")
            self.stdout.write(f"Registered Municipality: {boat.registered_municipality}")
            
            if current_muni and boat.registered_municipality:
                if current_muni == boat.registered_municipality:
                    self.stdout.write(self.style.SUCCESS("\n✓ Boat is in HOME waters (no violation)"))
                else:
                    self.stdout.write(self.style.ERROR(f"\n✗ VIOLATION! Boat should be in {boat.registered_municipality}, but is in {current_muni}"))
            elif not current_muni:
                self.stdout.write(self.style.ERROR("\n✗ ERROR: GPS coordinates are NOT inside any boundary polygon!"))
                self.stdout.write("   This is why violations aren't triggering.")
                self.stdout.write("   Possible causes:")
                self.stdout.write("     1. Boundary polygon coordinates are incorrect")
                self.stdout.write("     2. GPS coordinates are outside all municipality waters")
                self.stdout.write("     3. Coordinate order in polygon (lat/lng vs lng/lat)")
        
        # 5. Check Boundary Crossings
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("5. BOUNDARY CROSSINGS CHECK")
        self.stdout.write("=" * 100)
        
        # Calculate boat_id hash
        mfbr = boat.mfbr_number
        boat_id_hash = abs(hash(mfbr)) % (10 ** 8)
        
        self.stdout.write(f"MFBR: {mfbr}")
        self.stdout.write(f"Hash boat_id: {boat_id_hash}")
        
        # Check all crossings
        all_crossings = BoundaryCrossing.objects.filter(
            boat_id=boat_id_hash
        ).order_by('-crossing_timestamp')[:5]
        
        if all_crossings.exists():
            self.stdout.write(f"\nFound {all_crossings.count()} crossing(s):")
            for crossing in all_crossings:
                age = timezone.now() - crossing.crossing_timestamp
                age_min = int(age.total_seconds() / 60)
                
                status = "SENT" if crossing.sms_sent else f"PENDING ({age_min}min)"
                self.stdout.write(f"\n  Crossing ID: {crossing.id}")
                self.stdout.write(f"    Route: {crossing.from_municipality} → {crossing.to_municipality}")
                self.stdout.write(f"    Time: {crossing.crossing_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                self.stdout.write(f"    Age: {age_min} minutes")
                self.stdout.write(f"    Status: {status}")
                
                if not crossing.sms_sent:
                    if age >= timedelta(minutes=15):
                        self.stdout.write(self.style.ERROR(f"    ⚠ SHOULD HAVE TRIGGERED! (>15 min)"))
                    else:
                        remaining = 15 - age_min
                        self.stdout.write(f"    ⏱ {remaining} minutes until notification")
        else:
            self.stdout.write(self.style.WARNING("\n⚠ No boundary crossings found!"))
            self.stdout.write("  This means boundary detection is NOT working.")
            self.stdout.write("  Most likely cause: GPS coordinates not inside any boundary polygon.")
        
        # 6. Check Violations
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("6. VIOLATION NOTIFICATIONS")
        self.stdout.write("=" * 100)
        
        violations = BoundaryViolationNotification.objects.filter(
            mfbr_number=boat.mfbr_number
        ).order_by('-created_at')[:5]
        
        if violations.exists():
            self.stdout.write(f"Found {violations.count()} notification(s):")
            for v in violations:
                self.stdout.write(f"\n  ID: {v.id}")
                self.stdout.write(f"    Route: {v.from_municipality} → {v.to_municipality}")
                self.stdout.write(f"    Status: {v.status}")
                self.stdout.write(f"    Created: {v.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                self.stdout.write(f"    Dwell: {v.dwell_duration // 60} minutes")
        else:
            self.stdout.write("  No violation notifications found")
        
        # 7. POLYGON TEST - Test specific coordinates
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("7. POLYGON POINT-IN-POLYGON TEST")
        self.stdout.write("=" * 100)
        
        test_coords = [
            (16.671333, 120.403145, "Your ESP32 current location"),
            (16.6, 120.4, "Test point 1"),
            (16.5, 120.3, "Test point 2"),
        ]
        
        self.stdout.write("\nTesting coordinates against all polygons:")
        for lat, lng, label in test_coords:
            muni = boundary_service.get_municipality_at_point(lat, lng)
            result = muni if muni else "❌ NOT IN ANY BOUNDARY"
            self.stdout.write(f"  ({lat:.6f}, {lng:.6f}) - {label}")
            self.stdout.write(f"    → {result}")
        
        # 8. RECOMMENDATIONS
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("8. DIAGNOSTIC SUMMARY & RECOMMENDATIONS")
        self.stdout.write("=" * 100)
        
        issues = []
        
        if not recent_gps.exists():
            issues.append("❌ No GPS data - ESP32 not sending data or authentication failing")
        
        if latest:
            current_muni = boundary_service.get_municipality_at_point(latest.latitude, latest.longitude)
            if not current_muni:
                issues.append("❌ CRITICAL: GPS coordinates NOT inside any boundary polygon!")
                issues.append("   → Your polygons may have wrong coordinate order or wrong coords")
                issues.append("   → Check if polygons use [lng, lat] instead of [lat, lng]")
        
        if not all_crossings.exists():
            issues.append("❌ No boundary crossings detected - boundary detection not working")
        
        if boat.registered_municipality != tracker.municipality:
            issues.append(f"⚠ Mismatch: Boat registered to {boat.registered_municipality}, Tracker to {tracker.municipality}")
        
        if issues:
            self.stdout.write("\n🔍 ISSUES FOUND:")
            for issue in issues:
                self.stdout.write(f"  {issue}")
            
            self.stdout.write("\n💡 NEXT STEPS:")
            self.stdout.write("  1. Check your MunicipalityBoundary polygons in database")
            self.stdout.write("  2. Verify coordinate order: Should be [[lng, lat], [lng, lat], ...]")
            self.stdout.write("  3. Test if your GPS coordinates fall within any polygon")
            self.stdout.write("  4. Use online tool: geojson.io to visualize your polygons")
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ No critical issues found"))
            self.stdout.write("  System should be working. Wait for 15-minute dwell time.")
        
        self.stdout.write("\n" + "=" * 100)
        self.stdout.write("END OF DIAGNOSTIC")
        self.stdout.write("=" * 100 + "\n")
