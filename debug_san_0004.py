#!/usr/bin/env python
"""
Debug script for SAN-0004 tracker
"""
import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import BirukbilugTracker, Municipality, MunicipalityBoundary, LandBoundary

print("="*70)
print("DEBUG: SAN-0004 Tracker and Boundary Data")
print("="*70)

# Check if tracker exists
print("\n1. Checking Tracker SAN-0004...")
tracker = BirukbilugTracker.objects.filter(BirukBilugID="SAN-0004").first()

if not tracker:
    print("   ❌ ERROR: Tracker SAN-0004 not found in database!")
    print("   SOLUTION: Create tracker SAN-0004 in admin panel")
    sys.exit(1)
else:
    print(f"   ✅ Tracker found: {tracker.BirukBilugID}")
    print(f"   Municipality: {tracker.municipality or '(NOT SET)'}")
    print(f"   Status: {tracker.status}")
    if tracker.boat:
        print(f"   Boat: {tracker.boat.mfbr_number}")
    else:
        print(f"   Boat: (not assigned)")

if not tracker.municipality:
    print("\n   ❌ ERROR: Tracker has no municipality assigned!")
    print("   SOLUTION: Set municipality in tracker record")
    sys.exit(1)

municipality_name = tracker.municipality
print(f"\n2. Checking boundaries for '{municipality_name}'...")

# Check Municipality record
muni = Municipality.objects.filter(name__iexact=municipality_name).first()
if muni:
    print(f"   ✅ Municipality record found: {muni.name}")
    print(f"      Is Coastal: {muni.is_coastal}")
    print(f"      Prefix: {muni.prefix}")
else:
    print(f"   ⚠️  WARNING: No Municipality record for '{municipality_name}'")

# Check MunicipalityBoundary (water)
print(f"\n3. Checking MunicipalityBoundary (water)...")
water_boundaries = MunicipalityBoundary.objects.filter(name__icontains=municipality_name)
if water_boundaries.exists():
    for wb in water_boundaries:
        coord_count = len(wb.coordinates) if wb.coordinates else 0
        print(f"   ✅ Found: {wb.name}")
        print(f"      Coordinates: {coord_count} points")
        print(f"      Type: {type(wb.coordinates)}")
else:
    print(f"   ⚠️  No water boundary found (this is OK for inland municipalities)")

# Check LandBoundary
print(f"\n4. Checking LandBoundary (land)...")
land_boundaries = LandBoundary.objects.filter(name__icontains=municipality_name)
if land_boundaries.exists():
    for lb in land_boundaries:
        coord_count = 0
        if lb.coordinates:
            if isinstance(lb.coordinates, list):
                coord_count = len(lb.coordinates)
            elif isinstance(lb.coordinates, dict):
                if 'coordinates' in lb.coordinates:
                    coord_count = len(lb.coordinates['coordinates'])
        print(f"   ✅ Found: {lb.name}")
        print(f"      Coordinates: {coord_count} points")
        print(f"      Type: {type(lb.coordinates)}")
        
        # Show first few coordinates
        if lb.coordinates:
            print(f"      Sample data: {str(lb.coordinates)[:200]}...")
else:
    print(f"   ❌ ERROR: No land boundary found for '{municipality_name}'")
    print(f"   SOLUTION: Add land boundary via admin panel or run:")
    print(f"   python manage.py populate_test_land_boundaries")

# Check exact name matching
print(f"\n5. Checking exact name matching...")
print(f"   Tracker municipality: '{municipality_name}'")

water_exact = MunicipalityBoundary.objects.filter(name__iexact=municipality_name).first()
land_exact = LandBoundary.objects.filter(name__iexact=municipality_name).first()

if water_exact:
    print(f"   ✅ Water boundary exact match: '{water_exact.name}'")
elif land_exact:
    print(f"   ✅ Land boundary exact match: '{land_exact.name}'")
else:
    print(f"   ❌ No exact match found!")
    print(f"\n   Available boundary names:")
    all_water = MunicipalityBoundary.objects.all()
    all_land = LandBoundary.objects.all()
    
    if all_water.exists():
        print(f"   Water boundaries:")
        for wb in all_water:
            print(f"      - '{wb.name}'")
    
    if all_land.exists():
        print(f"   Land boundaries:")
        for lb in all_land:
            print(f"      - '{lb.name}'")
    
    # Check for similar names
    print(f"\n   Possible name mismatch!")
    print(f"   Tracker says: '{municipality_name}'")
    print(f"   Try updating tracker municipality to match boundary name exactly")

# Summary
print(f"\n{'='*70}")
print("SUMMARY")
print(f"{'='*70}")

issues = []
solutions = []

if not tracker:
    issues.append("Tracker SAN-0004 doesn't exist")
    solutions.append("Create tracker in admin panel")
elif not tracker.municipality:
    issues.append("Tracker has no municipality")
    solutions.append("Set municipality in tracker record")
elif not (water_exact or land_exact):
    issues.append(f"No boundary found for '{municipality_name}'")
    if land_boundaries.exists() or water_boundaries.exists():
        solutions.append("Check municipality name spelling - there might be a mismatch")
    else:
        solutions.append("Add boundary data via admin panel")

if issues:
    print("\n❌ ISSUES FOUND:")
    for i, issue in enumerate(issues, 1):
        print(f"   {i}. {issue}")
    print("\n💡 SOLUTIONS:")
    for i, solution in enumerate(solutions, 1):
        print(f"   {i}. {solution}")
else:
    print("\n✅ Everything looks good!")
    print("\nBoundary should work. If ESP32 still shows error:")
    print("1. Make sure backend server is restarted")
    print("2. Check backend logs for errors")
    print("3. Test endpoint: curl http://localhost:8000/api/device-boundary/SAN-0004/")

print(f"{'='*70}\n")

