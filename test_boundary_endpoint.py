#!/usr/bin/env python3
"""
Test script for ESP32 boundary provisioning endpoint.
Tests the /api/device-boundary/{device_id}/ endpoint that provides geofence data.
"""

import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8000"  # Change if your backend runs elsewhere
DEVICE_IDS_TO_TEST = [
    "SGB-0001",  # San Gabriel
    "SJU-0001",  # San Juan
    "BAC-0001",  # Bacnotan
]

def test_boundary_endpoint(device_id):
    """Test the boundary endpoint for a specific device."""
    url = f"{BASE_URL}/api/device-boundary/{device_id}/"
    
    print(f"\n{'='*70}")
    print(f"Testing: {device_id}")
    print(f"URL: {url}")
    print(f"{'='*70}")
    
    try:
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            print("\n✅ SUCCESS! Response received:")
            print(f"  Device ID: {data.get('device_id', 'N/A')}")
            print(f"  Status: {data.get('status', 'N/A')}")
            
            # Municipality info
            if 'municipality' in data:
                muni = data['municipality']
                print(f"\n  Municipality:")
                print(f"    Name: {muni.get('name', 'N/A')}")
                print(f"    Water Area: {muni.get('water_area_km2', 0)} km²")
                print(f"    Coastline: {muni.get('coastline_km', 0)} km")
                print(f"    Is Coastal: {muni.get('is_coastal', False)}")
            
            # Boat info (if assigned)
            if 'boat' in data:
                boat = data['boat']
                print(f"\n  Boat:")
                print(f"    MFBR: {boat.get('mfbr_number', 'N/A')}")
                print(f"    Name: {boat.get('name', 'N/A')}")
                print(f"    Municipality: {boat.get('registered_municipality', 'N/A')}")
            
            # Geofence info
            if 'geofence' in data:
                geofence = data['geofence']
                vertices = geofence.get('vertices', 0)
                polygon = geofence.get('polygon', [])
                boundary_type = geofence.get('type', 'unknown')
                
                print(f"\n  Geofence:")
                print(f"    Type: {boundary_type}")
                print(f"    Vertices: {vertices}")
                
                if polygon and len(polygon) > 0:
                    print(f"    First 3 points:")
                    for i, point in enumerate(polygon[:3]):
                        if len(point) >= 2:
                            print(f"      {i+1}. Lat: {point[0]:.6f}, Lng: {point[1]:.6f}")
                    
                    if len(polygon) > 3:
                        print(f"    ... and {len(polygon) - 3} more points")
                    
                    # Validate coordinate ranges (Philippines)
                    valid = True
                    for point in polygon:
                        if len(point) >= 2:
                            lat, lng = point[0], point[1]
                            # Philippines roughly: Lat 5-21, Lng 116-127
                            if not (4 < lat < 22 and 115 < lng < 128):
                                print(f"    ⚠️  WARNING: Point [{lat}, {lng}] outside Philippines range")
                                valid = False
                    
                    if valid:
                        print(f"    ✅ All coordinates within valid range")
                else:
                    print(f"    ❌ ERROR: Polygon is empty!")
                    return False
            else:
                print(f"\n  ❌ ERROR: No 'geofence' key in response!")
                return False
            
            # Pretty print full response
            print(f"\n  Full Response:")
            print(json.dumps(data, indent=2))
            
            return True
            
        elif response.status_code == 404:
            error_data = response.json()
            print(f"\n❌ ERROR 404: {error_data.get('error', 'Not found')}")
            if 'hint' in error_data:
                print(f"  Hint: {error_data['hint']}")
            return False
            
        elif response.status_code == 400:
            error_data = response.json()
            print(f"\n❌ ERROR 400: {error_data.get('error', 'Bad request')}")
            return False
            
        else:
            print(f"\n❌ ERROR: Unexpected status code {response.status_code}")
            print(f"  Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ CONNECTION ERROR: Cannot connect to {BASE_URL}")
        print(f"  Is the backend server running?")
        return False
        
    except requests.exceptions.Timeout:
        print(f"\n❌ TIMEOUT: Server took too long to respond")
        return False
        
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function."""
    print("="*70)
    print("ESP32 Boundary Endpoint Test")
    print("="*70)
    print(f"Testing endpoint: {BASE_URL}/api/device-boundary/<device_id>/")
    
    # Allow custom device ID from command line
    if len(sys.argv) > 1:
        device_ids = sys.argv[1:]
    else:
        device_ids = DEVICE_IDS_TO_TEST
    
    results = {}
    for device_id in device_ids:
        results[device_id] = test_boundary_endpoint(device_id)
    
    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for device_id, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {device_id}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())

