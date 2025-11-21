# ESP32 Boundary Provisioning Fix - COMPLETE

## Problems Found & Fixed

### Issue 1: Wrong Database Field Name
**Problem:** Backend was trying to access `boundary.boundary_geojson` which doesn't exist
**Solution:** Changed to use `boundary.coordinates` (the actual field name in the model)

### Issue 2: Wrong Response Format
**Problem:** Backend response didn't match ESP32 expected format
**Before:**
```json
{
  "device_id": "...",
  "municipality": "...",
  "boundary": {...}
}
```

**After (ESP32 compatible):**
```json
{
  "status": "ok",
  "device_id": "SGB-0001",
  "municipality": {
    "name": "San Gabriel",
    "water_area_km2": 45.0,
    "coastline_km": 5.5,
    "is_coastal": true
  },
  "geofence": {
    "vertices": 9,
    "polygon": [[16.6137, 120.3867], [16.6187, 120.3173], ...]
  }
}
```

### Issue 3: Only Checked Water Boundaries
**Problem:** Backend only checked `MunicipalityBoundary` (water boundaries)
**Solution:** Now checks both `MunicipalityBoundary` (coastal areas) AND `LandBoundary` (inland areas)

### Issue 4: Coordinate Format Detection
**Problem:** Different boundary sources may store coordinates in different formats
**Solution:** Added smart detection for:
- GeoJSON format: `{"type": "Polygon", "coordinates": [[[lng, lat], ...]]}`
- Simplified format: `{"coordinates": [[lng, lat], ...]}`
- Direct array: `[[lat, lng], ...]` or `[[lng, lat], ...]`
- Auto-detects and converts to ESP32 format: `[[lat, lng], ...]`

---

## Changes Made

### Backend (`backend/api/views.py`)
- ✅ Fixed `get_device_boundary()` function (lines 3682-3844)
- ✅ Added comprehensive logging for debugging
- ✅ Check both water and land boundaries
- ✅ Handle multiple coordinate formats
- ✅ Return ESP32-compatible JSON format
- ✅ Include boat info if tracker is assigned
- ✅ Better error messages

---

## How the System Works Now

### 1. Provisioning Flow
```
1. User provisions ESP32:
   - DEVICE_ID=SGB-0001
   - TOKEN=abc123...
   - PROVISION

2. ESP32 saves credentials to NVS

3. ESP32 automatically fetches boundary:
   - HTTP GET /api/device-boundary/SGB-0001/
   
4. Backend logic:
   a) Find tracker with ID "SGB-0001"
   b) Get tracker's municipality (e.g., "San Gabriel")
   c) Look for water boundary (MunicipalityBoundary)
   d) If not found, look for land boundary (LandBoundary)
   e) Parse coordinates and convert to [[lat, lng], ...]
   f) Return JSON with geofence.polygon array
   
5. ESP32 receives boundary:
   - Parses JSON using ArduinoJson
   - Saves polygon to NVS
   - Loads into memory for geofence checks

6. ESP32 reboots and loads:
   - Credentials from NVS
   - Boundary polygon from NVS
   - Ready to detect violations!
```

### 2. Violation Detection Logic (ESP32)

#### Movement-Aware Idle Detection
The ESP32 now implements smart violation detection:

**Inside Municipality:**
- ✅ All clear, no alarms

**Outside Municipality:**
- If boat moves > 50 meters: Reset idle timer (just passing through)
- If boat stays within 50 meters for 15+ minutes: **TRIGGER VIOLATION**
  - Local beeper sounds (5.6 seconds)
  - Violation flag saved to NVS (survives reboots)
  - 24-hour cooldown before next violation

**Key Features:**
- Reconnect-proof: Uses GPS Unix time, not millis()
- Reboot-proof: State saved to NVS
- One violation per 24 hours (no repeated alarms)
- 50-meter idle threshold prevents false positives

---

## Testing the Fix

### Step 1: Verify Backend Endpoint

**Test with existing tracker:**
```bash
# If your backend is running on localhost:8000
curl http://localhost:8000/api/device-boundary/SGB-0001/

# Or with ngrok:
curl http://your-ngrok-url.ngrok-free.dev/api/device-boundary/SGB-0001/
```

**Expected Response:**
```json
{
  "status": "ok",
  "device_id": "SGB-0001",
  "municipality": {
    "name": "San Gabriel",
    "water_area_km2": 45.0,
    "coastline_km": 5.5,
    "is_coastal": true
  },
  "geofence": {
    "vertices": 9,
    "polygon": [
      [16.6137, 120.3867],
      [16.6187, 120.3173],
      [16.63, 120.3083],
      [16.64, 120.3],
      [16.65, 120.31],
      [16.65, 120.33],
      [16.64, 120.35],
      [16.63, 120.37],
      [16.6137, 120.3867]
    ],
    "type": "land"
  },
  "timestamp": "2025-11-18T10:30:00Z"
}
```

**Possible Errors:**

| Error | Meaning | Solution |
|-------|---------|----------|
| `Device not found` | Tracker ID doesn't exist | Check tracker is created in admin |
| `No municipality assigned` | Tracker has no municipality | Set municipality in tracker record |
| `No boundary polygon found` | Municipality has no boundary data | Add boundary via Boundary Editor |

### Step 2: Test ESP32 Provisioning

**Serial Monitor Commands:**
```
DEVICE_ID=SGB-0001
TOKEN=your-actual-device-token-here
PROVISION
```

**Expected Serial Output:**
```
[PROV] Device ID set: SGB-0001
[PROV] OK TOKEN
[PROV] Using default host: your-ngrok-url.ngrok-free.dev
[PROV] Using default port: 80
[PROV] Using default path: /api/ingest/v1/positions/
[PROV] ✅ Credentials stored successfully!
[PROV] Fetching geofence boundary from backend...
[GEOFENCE] Fetching boundary from backend...
[GEOFENCE] GET http://your-ngrok-url:80/api/device-boundary/SGB-0001/
[GEOFENCE] HTTP Status: 200
[GEOFENCE] Response length: 456 bytes
[GEOFENCE] ✅ Loaded San Gabriel boundary: 9 vertices
[GEOFENCE] Saved polygon: 9 vertices
[PROV] ✅ Provisioning complete with boundary!
```

**If you see this instead:**
```
[PROV] ⚠ WARNING: Boundary fetch failed
[PROV] Device is provisioned but geofence is not configured
```

**Debug steps:**
1. Check backend logs for errors
2. Verify tracker municipality has boundary data
3. Test endpoint with curl (Step 1 above)
4. Check ESP32 has internet connection (PPP connected)

### Step 3: Verify Boundary Loaded on Boot

**After provisioning, reset ESP32 and check serial:**
```
[ESP32 PPPoS] Booting...
[CFG] device_id=SGB-0001 host=your-ngrok token:set provisioned=yes
[GEOFENCE] Loaded: outside=0 idleStart=0 hasLast=0 violated=0
[GEOFENCE] Loaded polygon: 9 vertices from NVS
[PROV] Device provisioned successfully!
[PROV] Device ID: SGB-0001
```

✅ If you see `"Loaded polygon: X vertices"` - **SUCCESS!**
❌ If you see `"No valid polygon in NVS"` - Re-provision with `PROVISION` command

### Step 4: Test Geofence Detection

**Simulate GPS positions:**
```cpp
// In ESP32 serial monitor after boot:
// (Feature to be added - currently automatic from GPS module)
```

**Watch serial for:**
```
[GEOFENCE] Just left polygon; entering outside state.
[GEOFENCE] Idle outside for 60 seconds
[GEOFENCE] Idle outside for 120 seconds
...
[GEOFENCE] Idle outside for 900 seconds
***** GEOFENCE VIOLATION (MOVEMENT-IDLE) *****
time=1700000000 lat=16.6500 lon=120.3500
*********************************************
[BEEP] Alert started (auto-off scheduled)
```

---

## Violation Logic Summary

### Constants (in ESP32 sketch)
```cpp
static const uint32_t VIOLATION_TIMEOUT_SECONDS = 15UL * 60UL;  // 15 minutes
static const float IDLE_DISTANCE_THRESHOLD_METERS = 50.0f;      // 50 meters
```

### State Machine
```
State: INSIDE_POLYGON
├─ GPS fix inside boundary → Stay in INSIDE_POLYGON
└─ GPS fix outside boundary → Move to OUTSIDE_POLYGON
                              Clear timers
                              
State: OUTSIDE_POLYGON
├─ GPS fix inside boundary → Return to INSIDE_POLYGON
│                            Clear timers, clear violation flag
│
├─ GPS fix outside + movement > 50m → Reset idle timer
│                                     (just passing through)
│
└─ GPS fix outside + movement <= 50m → Increment idle timer
                                        If idle_time >= 15 min:
                                        └─ TRIGGER VIOLATION
                                           ├─ Sound beeper (5.6s)
                                           ├─ Save violation flag to NVS
                                           ├─ Set 24-hour cooldown
                                           └─ Backend will send SMS
```

---

## Common Issues & Solutions

### Issue: "No boundary for that municipality"
**Causes:**
1. Municipality has no boundary data in database
2. Tracker municipality name doesn't match boundary name exactly
3. Backend endpoint error

**Solutions:**
1. Check if boundary exists:
   ```bash
   cd backend
   python manage.py shell
   ```
   ```python
   from api.models import MunicipalityBoundary, LandBoundary
   
   # Check water boundary
   water = MunicipalityBoundary.objects.filter(name__icontains="San Gabriel")
   print(f"Water boundaries: {water.count()}")
   for b in water:
       print(f"  - {b.name}: {len(b.coordinates) if b.coordinates else 0} points")
   
   # Check land boundary
   land = LandBoundary.objects.filter(name__icontains="San Gabriel")
   print(f"Land boundaries: {land.count()}")
   for b in land:
       print(f"  - {b.name}: {len(b.coordinates) if b.coordinates else 0} points")
   ```

2. Add boundary data:
   - Via admin panel: Boundary Editor
   - Via management command: `python manage.py populate_test_land_boundaries`

### Issue: "HTTP GET error: -1"
**Cause:** ESP32 can't connect to backend (network issue)

**Solutions:**
1. Check PPP connection: Serial monitor should show "PPP Connected"
2. Verify ngrok URL is accessible
3. Check firewall settings
4. Ensure backend is running

### Issue: "JSON parse error"
**Cause:** Backend returned invalid JSON or wrong format

**Solutions:**
1. Test endpoint with curl (see Step 1)
2. Check backend logs for errors
3. Verify boundary coordinates are valid JSON

### Issue: Violation triggers immediately
**Cause:** GPS coordinates show boat is outside boundary from start

**Solutions:**
1. Verify boundary polygon is correct (covers the actual area)
2. Check GPS coordinates are accurate
3. Use boundary editor to visualize polygon on map

### Issue: Violation never triggers
**Causes:**
1. GPS coordinates show boat is always inside boundary
2. Movement > 50m keeps resetting timer
3. Violation already triggered within 24 hours

**Solutions:**
1. Check serial logs: `[GEOFENCE]` messages
2. Verify idle timer is incrementing: `"Idle outside for X seconds"`
3. Check violation cooldown: `"Violation already triggered today"`

---

## Files Modified

### Backend
- `backend/api/views.py` (lines 3682-3844)
  - Completely rewrote `get_device_boundary()` function
  - Fixed field name bug
  - Added support for both water and land boundaries
  - Implemented coordinate format detection
  - Added comprehensive logging

### ESP32 (No changes needed - already correct!)
- `Arduino/esp32/esp32.ino`
  - `geofence_fetch_from_backend()` - Already correct (lines 1345-1449)
  - `geofence_process()` - Movement-aware logic (lines 1541-1617)
  - NVS persistence - Survives reboots (lines 1291-1343, 1472-1510)

---

## Next Steps

### 1. Restart Backend
```bash
cd backend
python manage.py runserver
```

### 2. Test Endpoint
```bash
curl http://localhost:8000/api/device-boundary/SGB-0001/
```

### 3. Re-Provision ESP32
```
PROVISION
```

### 4. Verify Boundary Loaded
Check serial for: `"Loaded polygon: X vertices"`

### 5. Test in Real World
- Take tracker to actual municipality
- Wait 15 minutes outside boundary
- Verify violation triggers

---

## Monitoring & Debugging

### Backend Logs
```bash
tail -f backend/logs/django.log
```

Look for:
```
[BOUNDARY] Device SGB-0001 requesting boundary data
[BOUNDARY] Device SGB-0001 is registered to San Gabriel
[BOUNDARY] Found land boundary for San Gabriel
[BOUNDARY] Successfully returning 9 vertices for San Gabriel
```

### ESP32 Serial Monitor
Key messages to watch:
- `[GEOFENCE] Loaded polygon: X vertices` - Boundary loaded on boot
- `[GEOFENCE] Just left polygon` - Exited boundary
- `[GEOFENCE] Idle outside for X seconds` - Timer running
- `[GEOFENCE] Movement detected: X m > 50.0 m` - Reset timer
- `***** GEOFENCE VIOLATION *****` - Violation triggered!

---

## Success Criteria

✅ Backend endpoint returns 200 status with geofence.polygon
✅ ESP32 fetches boundary during provisioning
✅ Polygon saved to NVS (survives reboot)
✅ ESP32 loads polygon on boot
✅ Geofence detection works (in/out detection)
✅ Idle timer increments when outside + movement < 50m
✅ Timer resets when movement > 50m
✅ Violation triggers after 15 minutes idle outside
✅ Beeper sounds on violation
✅ 24-hour cooldown prevents repeated alerts
✅ State survives ESP32 reboot

---

## Contact & Support

If you still see "no boundary" after following all steps:
1. Share backend logs (from provisioning request)
2. Share ESP32 serial output (full provisioning sequence)
3. Confirm municipality has boundary data in database
4. Test endpoint with curl and share response

