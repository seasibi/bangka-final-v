"""
Cleanup script to remove all test GPS data and related records
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import GpsData, BoundaryCrossing, BoundaryViolationNotification, DeviceToken

print("=" * 60)
print("🧹 CLEANING UP TEST DATA")
print("=" * 60)

# Count before deletion
gps_count = GpsData.objects.filter(boat_id__in=[1, 2, 3]).count()
crossing_count = BoundaryCrossing.objects.filter(boat_id__in=[1, 2, 3]).count()
violation_count = BoundaryViolationNotification.objects.filter(boat_id__in=[1, 2, 3]).count()

print(f"\n📊 Current Test Data:")
print(f"   - GPS Points: {gps_count}")
print(f"   - Boundary Crossings: {crossing_count}")
print(f"   - Violations: {violation_count}")

if gps_count == 0 and crossing_count == 0 and violation_count == 0:
    print("\n✅ No test data found - database is clean!")
else:
    print("\n🗑️  Deleting test data...")
    
    # Delete GPS data for test boats
    deleted_gps = GpsData.objects.filter(boat_id__in=[1, 2, 3]).delete()
    print(f"   ✅ Deleted {deleted_gps[0]} GPS points")
    
    # Delete boundary crossings for test boats
    deleted_crossings = BoundaryCrossing.objects.filter(boat_id__in=[1, 2, 3]).delete()
    print(f"   ✅ Deleted {deleted_crossings[0]} boundary crossings")
    
    # Delete violations for test boats
    deleted_violations = BoundaryViolationNotification.objects.filter(boat_id__in=[1, 2, 3]).delete()
    print(f"   ✅ Deleted {deleted_violations[0]} violations")
    
    print("\n" + "=" * 60)
    print("✅ CLEANUP COMPLETE - Database is now clean!")
    print("=" * 60)

print("\n💡 Ready to run simulation: python test_boat_simulation.py")
