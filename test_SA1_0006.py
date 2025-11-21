#!/usr/bin/env python3
"""
Test if SA1-0006 tracker can fetch boundary
"""
import requests
import sys

# Your ngrok URL (update if changed)
BASE_URL = "http://unskilfully-unsoftening-flynn.ngrok-free.dev"
TRACKER_ID = "SA1-0006"

print("="*70)
print(f"Testing Boundary Endpoint for {TRACKER_ID}")
print("="*70)

# Test 1: Can we reach the server?
print("\n1. Testing server connectivity...")
try:
    response = requests.get(f"{BASE_URL}/api/municipalities/", timeout=10)
    print(f"   ✅ Server is reachable (status: {response.status_code})")
except Exception as e:
    print(f"   ❌ Cannot reach server: {e}")
    print(f"   Check: Is backend running? Is ngrok active?")
    sys.exit(1)

# Test 2: Does tracker exist?
print(f"\n2. Testing boundary endpoint for {TRACKER_ID}...")
url = f"{BASE_URL}/api/device-boundary/{TRACKER_ID}/"
print(f"   URL: {url}")

try:
    response = requests.get(url, timeout=10)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n   ✅ SUCCESS!")
        print(f"   Device: {data.get('device_id')}")
        print(f"   Municipality: {data.get('municipality', {}).get('name')}")
        print(f"   Vertices: {data.get('geofence', {}).get('vertices')}")
        
        # Show first 3 coordinates
        polygon = data.get('geofence', {}).get('polygon', [])
        if polygon:
            print(f"\n   First 3 coordinates:")
            for i, point in enumerate(polygon[:3]):
                print(f"     {i+1}. [{point[0]:.6f}, {point[1]:.6f}]")
    
    elif response.status_code == 404:
        print(f"\n   ❌ ERROR 404: {response.json()}")
        print(f"\n   Possible issues:")
        print(f"   - Tracker {TRACKER_ID} doesn't exist in database")
        print(f"   - Tracker has no municipality assigned")
        print(f"   - Municipality has no boundary data")
        
except requests.exceptions.Timeout:
    print(f"   ❌ TIMEOUT: Server took too long to respond")
    print(f"   This might be why ESP32 gets error -1")
    
except Exception as e:
    print(f"   ❌ ERROR: {e}")

# Test 3: Check if tracker exists in database
print(f"\n3. Checking if tracker exists in database...")
print(f"   Run this in Django shell:")
print(f"   python manage.py shell")
print(f"   >>> from api.models import BirukbilugTracker")
print(f"   >>> BirukbilugTracker.objects.filter(BirukBilugID='{TRACKER_ID}').exists()")
print(f"   >>> tracker = BirukbilugTracker.objects.get(BirukBilugID='{TRACKER_ID}')")
print(f"   >>> print(f'Municipality: {{tracker.municipality}}')")

print("\n" + "="*70)

