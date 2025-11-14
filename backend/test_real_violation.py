"""
Enhanced Violation Test with REAL Fisherfolk Data
This script will:
1. Use an actual registered boat with fisherfolk data
2. Simulate GPS movement to trigger violation
3. Populate all enhanced notification fields
4. Enable hover and click functionality with real data
"""
import os
import sys
import django
import time
from datetime import datetime, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
from api.models import (
    Boat, Fisherfolk, GpsData, BoundaryCrossing,
    BoundaryViolationNotification, Municipality
)
import requests

# API endpoint
API_URL = "http://localhost:8000/api/gps/"

def find_registered_boat():
    """Find a boat with real fisherfolk registration"""
    print("=" * 70)
    print("🔍 FINDING REGISTERED BOAT WITH FISHERFOLK DATA")
    print("=" * 70)
    print()
    
    # Get boats with fisherfolk registration
    boats = Boat.objects.select_related(
        'fisherfolk_registration_number'
    ).filter(
        fisherfolk_registration_number__isnull=False,
        is_active=True
    )
    
    if not boats.exists():
        print("❌ No registered boats found!")
        print()
        print("Creating a test boat with fisherfolk...")
        return create_test_boat()
    
    boats_list = list(boats[:5])  # Convert to list to avoid query issues
    
    print(f"✅ Found {len(boats_list)} registered boats")
    print()
    
    # Display available boats
    for i, boat in enumerate(boats_list, 1):
        ff = boat.fisherfolk_registration_number
        print(f"{i}. {boat.mfbr_number} - {boat.boat_name}")
        if ff:
            print(f"   Owner: {ff.first_name} {ff.middle_name} {ff.last_name}")
            print(f"   Contact: {ff.contact_number or 'N/A'}")
            print(f"   Municipality: {boat.registered_municipality}")
        print()
    
    # Use the first boat
    selected_boat = boats_list[0]
    print(f"🎯 Selected: {selected_boat.mfbr_number} - {selected_boat.boat_name}")
    print()
    
    return selected_boat

def create_test_boat():
    """Create a test boat with fisherfolk if none exists"""
    # Get or create test municipality
    san_fernando, _ = Municipality.objects.get_or_create(
        name="City of San Fernando",
        defaults={'color': '#3b82f6'}
    )
    
    # Create or get fisherfolk
    fisherfolk, created = Fisherfolk.objects.get_or_create(
        mfbr_number='LU-CSF-TEST001',
        defaults={
            'last_name': 'Dela Cruz',
            'first_name': 'Juan',
            'middle_name': 'Santos',
            'contact_number': '+63 917 123 4567',
            'date_of_birth': '1980-01-01',
            'gender': 'Male',
            'nationality': 'Filipino',
            'civil_status': 'Married',
            'religion': 'Catholic',
            'is_active': True
        }
    )
    
    # Create boat
    boat, created = Boat.objects.get_or_create(
        mfbr_number='LU-CSF-TEST001',
        defaults={
            'fisherfolk_registration_number': fisherfolk,
            'boat_name': 'Test Bangka Alpha',
            'application_date': timezone.now().date(),
            'type_of_registration': 'New/Initial Registration',
            'type_of_ownership': 'Individual',
            'boat_type': 'Motorized',
            'fishing_ground': 'Municipal Waters',
            'fma_number': 'FMA-001',
            'built_place': 'San Fernando',
            'no_fishers': 3,
            'material_used': 'Wood',
            'homeport': 'San Fernando',
            'built_year': 2020,
            'engine_make': 'Yamaha',
            'serial_number': 'TEST123',
            'horsepower': '16hp',
            'registered_municipality': 'City of San Fernando',
            'is_active': True
        }
    )
    
    if created:
        print("✅ Created test boat with fisherfolk data")
    
    return boat

def simulate_violation(boat, minutes_to_wait=17):
    """
    Simulate boat movement triggering a violation
    Args:
        boat: Boat object
        minutes_to_wait: How many minutes to dwell (default 17 to exceed 15-min threshold)
    """
    ff = boat.fisherfolk_registration_number
    
    print("=" * 70)
    print("🚤 STARTING VIOLATION SIMULATION")
    print("=" * 70)
    print()
    print(f"📋 BOAT DETAILS:")
    print(f"   MFBR: {boat.mfbr_number}")
    print(f"   Name: {boat.boat_name}")
    print(f"   Owner: {ff.first_name} {ff.middle_name} {ff.last_name}")
    print(f"   Contact: {ff.contact_number}")
    print(f"   Home Municipality: {boat.registered_municipality}")
    print()
    print(f"⏱️  Violation Trigger Time: {minutes_to_wait} minutes")
    print()
    
    # Coordinates
    SAN_FERNANDO_LAT = 16.6163
    SAN_FERNANDO_LNG = 120.3168
    SAN_JUAN_LAT = 16.6711
    SAN_JUAN_LNG = 120.3431
    
    # Phase 1: Start in home municipality (San Fernando)
    print("🔷 PHASE 1: Initial Position (San Fernando)")
    print("-" * 70)
    
    initial_data = {
        'latitude': SAN_FERNANDO_LAT,
        'longitude': SAN_FERNANDO_LNG,
        'boat_id': boat.mfbr_number,
        'mfbr_number': boat.mfbr_number
    }
    
    try:
        response = requests.post(API_URL, json=initial_data)
        print(f"   ✅ GPS sent: {SAN_FERNANDO_LAT}, {SAN_FERNANDO_LNG}")
        print(f"   Status: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    time.sleep(2)
    
    # Phase 2: Move to San Juan (crossing boundary)
    print()
    print("🔷 PHASE 2: Moving to San Juan (Boundary Crossing)")
    print("-" * 70)
    
    # Interpolate movement
    steps = 10
    for i in range(steps + 1):
        ratio = i / steps
        lat = SAN_FERNANDO_LAT + (SAN_JUAN_LAT - SAN_FERNANDO_LAT) * ratio
        lng = SAN_FERNANDO_LNG + (SAN_JUAN_LNG - SAN_FERNANDO_LNG) * ratio
        
        movement_data = {
            'latitude': lat,
            'longitude': lng,
            'boat_id': boat.mfbr_number,
            'mfbr_number': boat.mfbr_number
        }
        
        try:
            response = requests.post(API_URL, json=movement_data)
            print(f"   📍 Waypoint {i+1}/{steps+1}: {lat:.6f}, {lng:.6f} - Status: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error at waypoint {i+1}: {e}")
        
        time.sleep(1)
    
    print()
    print(f"✅ Boat arrived in San Juan!")
    print()
    
    # Phase 3: Stay in San Juan to trigger violation
    print("🔷 PHASE 3: Dwelling in San Juan (Triggering Violation)")
    print("-" * 70)
    print(f"⏱️  Will stay for {minutes_to_wait} minutes")
    print(f"   Violation threshold: 15 minutes")
    print()
    
    violation_triggered = False
    
    for minute in range(minutes_to_wait):
        dwell_data = {
            'latitude': SAN_JUAN_LAT + 0.0001,  # Small offset
            'longitude': SAN_JUAN_LNG + 0.0001,
            'boat_id': boat.mfbr_number,
            'mfbr_number': boat.mfbr_number
        }
        
        try:
            response = requests.post(API_URL, json=dwell_data)
            
            if minute >= 14 and not violation_triggered:
                print(f"   ⏰ Minute {minute+1}/{minutes_to_wait} 🚨 VIOLATION EXPECTED!")
                violation_triggered = True
            else:
                remaining = 15 - minute - 1
                if remaining > 0:
                    print(f"   ⏰ Minute {minute+1}/{minutes_to_wait} ✅ ({remaining} min until violation)")
                else:
                    print(f"   ⏰ Minute {minute+1}/{minutes_to_wait} 🚨 IN VIOLATION STATE")
        except Exception as e:
            print(f"   ❌ Error at minute {minute+1}: {e}")
        
        if minute < minutes_to_wait - 1:
            time.sleep(60)  # Wait 1 minute
    
    print()
    print("=" * 70)
    print("✅ SIMULATION COMPLETE!")
    print("=" * 70)
    
    return boat

def populate_violation_details(boat):
    """Populate enhanced fields for the violation"""
    print()
    print("=" * 70)
    print("🔧 POPULATING ENHANCED VIOLATION DETAILS")
    print("=" * 70)
    print()
    
    ff = boat.fisherfolk_registration_number
    
    # Find the violation
    violation = BoundaryViolationNotification.objects.filter(
        mfbr_number=boat.mfbr_number
    ).order_by('-created_at').first()
    
    if not violation:
        print("❌ No violation found! The violation may not have been triggered yet.")
        print("   Wait for 15+ minutes of dwelling before violation is created.")
        return None
    
    print(f"✅ Found violation: ID {violation.id}")
    print()
    
    # Populate enhanced fields
    violation.owner_name = f"{ff.first_name} {ff.middle_name} {ff.last_name}".strip()
    violation.contact_person_name = f"{ff.first_name} {ff.last_name}"
    violation.contact_person_phone = ff.contact_number or '+63 917 000 0000'
    violation.registration_number = boat.mfbr_number
    violation.report_status = 'Not Reported'
    violation.remarks = f'Boat observed dwelling in San Juan for extended period. Owner {violation.owner_name} has been notified.'
    
    # Set timestamps
    now = timezone.now()
    violation.timestamp_end = now
    violation.timestamp_start = now - timedelta(minutes=violation.dwell_duration // 60)
    violation.idle_minutes = violation.dwell_duration // 60
    
    # Generate report number if not set
    if not violation.report_number:
        year = now.year
        count = BoundaryViolationNotification.objects.filter(
            report_number__startswith=f'RPT-{year}-'
        ).count()
        violation.report_number = f'RPT-{year}-{count+1:04d}'
    
    violation.save()
    
    print("📋 ENHANCED FIELDS POPULATED:")
    print(f"   Owner Name: {violation.owner_name}")
    print(f"   Contact Person: {violation.contact_person_name}")
    print(f"   Phone: {violation.contact_person_phone}")
    print(f"   Report Number: {violation.report_number}")
    print(f"   Report Status: {violation.report_status}")
    print(f"   Idle Duration: {violation.idle_minutes} minutes")
    print(f"   Start Time: {violation.timestamp_start}")
    print(f"   End Time: {violation.timestamp_end}")
    print()
    
    return violation

def display_results(boat, violation):
    """Display test results and verification steps"""
    print("=" * 70)
    print("🎯 TESTING GUIDE")
    print("=" * 70)
    print()
    
    print("1️⃣  MAP VIEW - HOVER TEST:")
    print("-" * 70)
    print("   • Open: http://localhost:3000 (or your frontend port)")
    print("   • Navigate to BirukBilug Tracking map")
    print(f"   • Look for boat marker: {boat.mfbr_number}")
    print("   • Hover over the marker")
    print()
    print("   ✅ Should display:")
    print(f"      - MFBR: {boat.mfbr_number}")
    print(f"      - Name: {boat.boat_name}")
    if violation and violation.idle_minutes >= 15:
        print("      - Status: 🚨 VIOLATION (RED)")
    else:
        print("      - Status: ✅ Normal")
    print()
    
    print("2️⃣  MAP VIEW - CLICK TEST:")
    print("-" * 70)
    print("   • Click on the boat marker")
    print("   • Popup should open with full details:")
    print(f"      - Owner: {violation.owner_name if violation else 'Loading...'}")
    print(f"      - MFBR: {boat.mfbr_number}")
    print(f"      - Municipality: {boat.registered_municipality}")
    print("   • Click 'View Tracker History' button")
    print()
    
    print("3️⃣  TRACKER HISTORY TEST:")
    print("-" * 70)
    print("   • Timeline panel should slide in from right")
    print("   • Should show events:")
    print("      ✅ Registered")
    print("      📡 Online")
    print("      📍 Boundary Crossing (San Fernando → San Juan)")
    if violation and violation.idle_minutes >= 15:
        print("      🚨 Violation (15+ minutes in San Juan)")
    print()
    
    if violation:
        print("4️⃣  NOTIFICATION PAGE TEST:")
        print("-" * 70)
        print("   • Navigate to Notifications page")
        print(f"   • Find: {boat.boat_name} Subject for Questioning")
        print(f"   • Report Number: {violation.report_number}")
        print("   • Click to view details")
        print()
        print("   ✅ Should display:")
        print(f"      - Owner: {violation.owner_name}")
        print(f"      - Contact: {violation.contact_person_phone}")
        print(f"      - Status: {violation.report_status}")
        print(f"      - Duration: {violation.idle_minutes} minutes")
        print("      - Full violation description with exact format")
        print()
    
    print("5️⃣  ENHANCED FEATURES TEST:")
    print("-" * 70)
    if violation:
        print(f"   • Direct link: http://localhost:3000/notifications/{violation.id}")
        print("   (After adding route to App.jsx)")
    print()
    print("   Test these features:")
    print("   □ Visual status indicator (color-coded)")
    print("   □ Edit Status button (municipal users)")
    print("   □ Audit log timeline")
    print("   □ Print report")
    print("   □ Download PDF")
    print()
    
    print("=" * 70)
    print("📊 DATABASE VERIFICATION")
    print("=" * 70)
    print()
    print("Run this in Django shell (python manage.py shell):")
    print()
    print(f"from api.models import BoundaryViolationNotification")
    if violation:
        print(f"v = BoundaryViolationNotification.objects.get(id={violation.id})")
        print(f"print(f'Owner: {{v.owner_name}}')")
        print(f"print(f'Contact: {{v.contact_person_phone}}')")
        print(f"print(f'Report: {{v.report_number}}')")
        print(f"print(f'Status: {{v.report_status}}')")
    print()
    
    print("=" * 70)

def main():
    print("\n" * 2)
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "ENHANCED VIOLATION TEST SIMULATION" + " " * 19 + "║")
    print("║" + " " * 20 + "With Real Fisherfolk Data" + " " * 23 + "║")
    print("╚" + "═" * 68 + "╝")
    print()
    
    try:
        # Step 1: Find registered boat
        boat = find_registered_boat()
        
        if not boat:
            print("❌ No boat available for testing")
            return
        
        # Step 2: Run simulation
        print("⏱️  Starting simulation in 3 seconds...")
        print("   (Make sure backend is running on localhost:8000)")
        time.sleep(3)
        
        boat = simulate_violation(boat, minutes_to_wait=17)
        
        # Step 3: Wait a bit for violation to be processed
        print("\n⏳ Waiting 5 seconds for violation to be processed...")
        time.sleep(5)
        
        # Step 4: Populate enhanced fields
        violation = populate_violation_details(boat)
        
        # Step 5: Display results
        display_results(boat, violation)
        
        print("=" * 70)
        print("🎉 SIMULATION COMPLETE!")
        print("=" * 70)
        print()
        print("✅ Now test the features on the frontend!")
        print()
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Simulation interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
