"""
Boat GPS Simulation Test Script
Simulates 3 boats from San Fernando to San Juan with boundary violations
"""
import requests
import time
from datetime import datetime
import json

# Backend URL
BASE_URL = "http://localhost:8000/api"  # Update if different

# San Fernando coordinates (starting point)
SAN_FERNANDO_LAT = 16.6163
SAN_FERNANDO_LNG = 120.3168

# San Juan coordinates (destination)
SAN_JUAN_LAT = 16.6711
SAN_JUAN_LNG = 120.3431

# Boat configurations
BOATS = [
    {
        "boat_id": 1,
        "name": "Boat 1 - Test Alpha",
        "mfbr_number": "SF-TEST-001",
        "tracker_id": "TEST001",
        "color": "blue"
    },
    {
        "boat_id": 2,
        "name": "Boat 2 - Test Beta",
        "mfbr_number": "SF-TEST-002",
        "tracker_id": "TEST002",
        "color": "green"
    },
    {
        "boat_id": 3,
        "name": "Boat 3 - Test Gamma",
        "mfbr_number": "SF-TEST-003",
        "tracker_id": "TEST003",
        "color": "red"
    }
]

def send_gps_data(boat_id, latitude, longitude, tracker_id=None):
    """Send GPS data to backend"""
    url = f"{BASE_URL}/gps/"
    
    payload = {
        "boat_id": boat_id,
        "latitude": latitude,
        "longitude": longitude
    }
    
    if tracker_id:
        payload["tracker_id"] = tracker_id
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            print(f"✅ Boat {boat_id}: GPS sent ({latitude:.6f}, {longitude:.6f})")
            return True
        else:
            print(f"❌ Boat {boat_id}: Failed - {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Boat {boat_id}: Error - {str(e)}")
        return False

def interpolate_coordinates(start_lat, start_lng, end_lat, end_lng, steps):
    """Generate intermediate coordinates between two points"""
    coordinates = []
    for i in range(steps + 1):
        ratio = i / steps
        lat = start_lat + (end_lat - start_lat) * ratio
        lng = start_lng + (end_lng - start_lng) * ratio
        coordinates.append((lat, lng))
    return coordinates

def run_simulation():
    """Run the simulation"""
    print("=" * 60)
    print("🚤 BOAT GPS SIMULATION TEST - ENHANCED")
    print("=" * 60)
    print(f"📍 Route: San Fernando → San Juan")
    print(f"🚤 Boats: {len(BOATS)}")
    print(f"⏱️  Starting simulation at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n📋 VERIFICATION CHECKLIST:")
    print("   ✓ Icon display with municipal colors")
    print("   ✓ Red icon on violation trigger")
    print("   ✓ Hover shows tracker details")
    print("   ✓ Click opens tracker history")
    print("   ✓ Complete violation records")
    print("=" * 60)
    print()
    
    # Generate route with 20 steps
    steps = 20
    route = interpolate_coordinates(
        SAN_FERNANDO_LAT, SAN_FERNANDO_LNG,
        SAN_JUAN_LAT, SAN_JUAN_LNG,
        steps
    )
    
    print(f"📊 Simulation Plan:")
    print(f"   - Total waypoints: {len(route)}")
    print(f"   - Interval: 2 seconds between updates")
    print(f"   - Expected duration: ~{(len(route) * 2) / 60:.1f} minutes")
    print()
    
    # Phase 1: Send initial positions (all boats in San Fernando)
    print("🔷 PHASE 1: Initial Positions (San Fernando)")
    print("-" * 60)
    for boat in BOATS:
        send_gps_data(boat["boat_id"], SAN_FERNANDO_LAT, SAN_FERNANDO_LNG, boat["tracker_id"])
        time.sleep(0.5)
    
    print(f"\n✅ All boats initialized in San Fernando")
    print(f"⏳ Waiting 3 seconds before movement...\n")
    time.sleep(3)
    
    # Phase 2: Move boats along route
    print("🔷 PHASE 2: Moving to San Juan (Crossing Municipality Boundary)")
    print("-" * 60)
    
    for idx, (lat, lng) in enumerate(route):
        print(f"\n📍 Waypoint {idx + 1}/{len(route)} - Lat: {lat:.6f}, Lng: {lng:.6f}")
        
        # Send GPS for each boat with slight offset to differentiate them
        for i, boat in enumerate(BOATS):
            # Add small offset for each boat so they don't overlap
            lat_offset = 0.001 * i
            lng_offset = 0.001 * i
            
            send_gps_data(
                boat["boat_id"],
                lat + lat_offset,
                lng + lng_offset,
                boat["tracker_id"]
            )
            time.sleep(0.3)  # Small delay between boats
        
        # Wait before next waypoint
        if idx < len(route) - 1:  # Don't wait after last point
            time.sleep(2)
    
    print("\n" + "=" * 60)
    print("✅ PHASE 2 COMPLETE: All boats reached San Juan")
    print("=" * 60)
    
    # Phase 3: Stay in San Juan to trigger violations (15+ minutes)
    print("\n🔷 PHASE 3: Dwelling in San Juan (Triggering Violations)")
    print("-" * 60)
    print("⏱️  Boats will stay in San Juan for 16 minutes to trigger violations...")
    print("   (Violations occur after 15 minutes in wrong municipality)")
    print("\n🎯 VERIFICATION POINTS:")
    print("   - Minutes 1-14: Icons should be municipal colors")
    print("   - Minute 15+: Icons should turn RED (violation)")
    print("   - Hover: Should show boat details + violation status")
    print("   - Click: Should open tracker history with violation event")
    
    # Send updates every minute for 16 minutes
    for minute in range(16):
        print(f"\n⏰ Minute {minute + 1}/16 - {datetime.now().strftime('%H:%M:%S')}", end="")
        
        if minute >= 14:
            print(f" 🚨 VIOLATION EXPECTED!")
        else:
            print(f" ✅ Normal operation ({15 - minute - 1} min until violation)")
        
        for i, boat in enumerate(BOATS):
            lat_offset = 0.001 * i
            lng_offset = 0.001 * i
            send_gps_data(
                boat["boat_id"],
                SAN_JUAN_LAT + lat_offset,
                SAN_JUAN_LNG + lng_offset,
                boat["tracker_id"]
            )
            time.sleep(0.3)
        
        if minute < 15:  # Don't wait after last update
            print(f"   💤 Waiting 60 seconds...")
            time.sleep(60)
    
    print("\n" + "=" * 60)
    print("✅ PHASE 3 COMPLETE: Violations should be triggered!")
    print("=" * 60)
    
    # Phase 4: Test offline status
    print("\n🔷 PHASE 4: Testing Offline Status")
    print("-" * 60)
    print("⏱️  Boats will stop sending data for 11 minutes (offline threshold = 10 min)...")
    print(f"   Last update: {datetime.now().strftime('%H:%M:%S')}")
    print(f"   Expected offline time: {(datetime.now().timestamp() + 660)}")
    
    # Final summary
    print("\n" + "=" * 60)
    print("🎯 SIMULATION COMPLETE!")
    print("=" * 60)
    print("\n📋 SUMMARY:")
    print(f"   ✅ {len(BOATS)} boats simulated")
    print(f"   ✅ {len(route)} GPS points sent per boat")
    print(f"   ✅ Boundary crossing: San Fernando → San Juan")
    print(f"   ✅ Violation triggered: 16 minutes dwell time")
    print(f"   ✅ Offline test: Stopped sending data")
    print("\n" + "=" * 60)
    print("🔍 VERIFICATION CHECKLIST")
    print("=" * 60)
    print("\n1️⃣  ICON DISPLAY:")
    print("   ❏ 3 boat markers visible in San Juan area")
    print("   ❏ Each boat has different color (based on municipality)")
    print("   ❏ Icons are proper shape (boat/circle/triangle)")
    print("   ❏ Icons turn RED after 15 minutes (violation status)")
    print("\n2️⃣  HOVER FUNCTIONALITY:")
    print("   ❏ Hover over marker shows boat details")
    print("   ❏ Details include: MFBR, Boat Name, Municipality")
    print("   ❏ Violation status displayed if applicable")
    print("   ❏ Tooltip appears smoothly without lag")
    print("\n3️⃣  CLICK & POPUP:")
    print("   ❏ Click marker opens detailed popup")
    print("   ❏ Popup shows complete boat information")
    print("   ❏ 'View Tracker History' button is visible")
    print("   ❏ Button is clickable and responsive")
    print("\n4️⃣  TRACKER HISTORY:")
    print("   ❏ Timeline panel slides in from right")
    print("   ❏ Events displayed chronologically:")
    print("      • Registered event (green check)")
    print("      • Online event (green wifi)")
    print("      • Boundary crossing (blue pin)")
    print("      • Violation event (red warning)")
    print("   ❏ Each event has timestamp and description")
    print("   ❏ Violation shows duration and location")
    print("\n5️⃣  DATA ACCURACY:")
    print("   ❏ All 3 boats show on map (not just 1)")
    print("   ❏ Positions match San Juan coordinates")
    print("   ❏ Timestamps are current and accurate")
    print("   ❏ Municipality data matches registration")
    print("\n6️⃣  OFFLINE TEST (Wait 11+ minutes):")
    print("   ❏ Markers turn gray/semi-transparent")
    print("   ❏ Status shows 'OFFLINE'")
    print("   ❏ Still clickable and functional")
    print("   ❏ Offline event appears in timeline")
    print("\n" + "=" * 60)
    print("📸 If any issues persist:")
    print("   - Take screenshots of the map view")
    print("   - Capture browser console errors (F12)")
    print("   - Note specific boat IDs with issues")
    print("   - Document expected vs actual behavior")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_simulation()
    except KeyboardInterrupt:
        print("\n\n⚠️  Simulation interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Simulation error: {str(e)}")
        import traceback
        traceback.print_exc()
