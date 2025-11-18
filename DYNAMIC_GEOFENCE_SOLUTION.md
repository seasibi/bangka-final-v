# Dynamic Geofence Provisioning Solution

## Problem
Hard-coding geofence boundaries in ESP32 firmware means:
- ❌ Every tracker needs custom firmware for its municipality
- ❌ Can't reassign trackers to different locations
- ❌ Boundary updates require reflashing all devices

## Solution
**Dynamic boundary fetching during provisioning**

---

## Architecture

```
┌──────────────┐
│   ESP32      │
│   Tracker    │
└──────┬───────┘
       │
       │ 1) PROVISION command
       │
       ▼
┌──────────────────────────────────┐
│ GET /api/device-boundary/{id}/   │
│                                  │
│ - Finds device's boat            │
│ - Gets fisherfolk municipality   │
│ - Returns polygon for that area  │
└──────┬───────────────────────────┘
       │
       │ 2) Returns JSON:
       │    {
       │      "geofence": {
       │        "vertices": 5,
       │        "polygon": [[lat,lng], ...]
       │      }
       │    }
       ▼
┌──────────────┐
│   ESP32      │
│  Stores in   │
│     NVS      │
└──────────────┘
```

---

## Backend Implementation ✅ DONE

###  1. New API Endpoint

**URL:** `GET /api/device-boundary/{device_id}/`

**Response:**
```json
{
  "status": "ok",
  "device_id": "SJU-0001",
  "boat": {
    "mfbr_number": "LU-SJN-111",
    "name": "Boat Name"
  },
  "municipality": {
    "name": "San Juan",
    "water_area_km2": 83.76,
    "coastline_km": 6.44
  },
  "geofence": {
    "vertices": 5,
    "polygon": [
      [16.653890, 120.315560],
      [16.721670, 120.178610],
      [16.757500, 120.188890],
      [16.702220, 120.335560],
      [16.653890, 120.315560]
    ]
  }
}
```

### Testing
```bash
cd backend
python manage.py runserver

# In another terminal:
python test_boundary_endpoint.py
```

---

## ESP32 Implementation (TO DO)

### Changes Needed:

#### 1. **NVS Storage for Boundary**
Store polygon points in NVS alongside device_id and token:
- `geofence_vertices` (int)
- `geofence_lat_0`, `geofence_lng_0`
- `geofence_lat_1`, `geofence_lng_1`
- ... (up to max vertices)

#### 2. **Fetch Boundary During Provisioning**
When user sends `PROVISION` command:
```cpp
// After saving TOKEN and DEVICE_ID:
1. Make HTTP GET to /api/device-boundary/{device_id}/
2. Parse JSON response
3. Extract polygon array
4. Save to NVS
5. Load into GEOFENCE_POLYGON array
```

#### 3. **Dynamic Polygon Array**
Replace static array with dynamic allocation:
```cpp
// Before (hard-coded):
static const GeoPoint GEOFENCE_POLYGON[] = {...};
static const size_t GEOFENCE_VERTICES = 5;

// After (dynamic):
static GeoPoint* g_geofence_polygon = nullptr;
static size_t g_geofence_vertices = 0;
```

---

## Provisioning Flow (New)

### Web Serial Provisioning Steps:

```
1. User: DEVICE_ID=SJU-0001
2. User: TOKEN=abc123...
3. User: PROVISION

ESP32 actions on PROVISION:
├── Save DEVICE_ID and TOKEN to NVS
├── HTTP GET /api/device-boundary/SJU-0001/
├── Parse JSON polygon
├── Save polygon to NVS
├── Load polygon into memory
└── Print: "✅ Provisioned with San Juan boundary (5 vertices)"

4. ESP32 reboots and loads:
   - Device credentials
   - Geofence polygon
   - Geofence state (idle timer, etc.)
```

---

## Benefits

✅ **One firmware for all trackers** - no per-municipality compilation
✅ **Reassignable** - change boat's municipality in backend, re-provision
✅ **Centrally managed** - update boundaries in database, trackers re-fetch
✅ **Auto-configured** - correct boundary based on boat's registered location
✅ **Scalable** - supports 10+ municipalities without code changes

---

## Migration Path

### For Existing Trackers:

1. Flash updated firmware (with dynamic provisioning)
2. Re-provision via Web Serial:
   ```
   DEVICE_ID=SJU-0001
   TOKEN=(existing token)
   PROVISION
   ```
3. ESP32 fetches and stores its boundary automatically

### For New Trackers:

1. Register boat in admin panel (assign municipality)
2. Create device token
3. Flash firmware
4. Provision via Web Serial (one time)
5. Done - tracker has correct boundary

---

## Next Steps

### Backend ✅ COMPLETE
- [x] Create `/api/device-boundary/{device_id}/` endpoint
- [x] Add URL route
- [x] Test with SJU-0001

### ESP32 (Requires Implementation)
- [ ] Add dynamic polygon storage in NVS
- [ ] Add HTTP GET to fetch boundary during provisioning
- [ ] Add JSON parsing for polygon array
- [ ] Update provisioning command handler
- [ ] Test with multiple municipalities

### Testing
- [ ] Provision SJU-0001 (San Juan)
- [ ] Verify boundary loads from backend
- [ ] Test geofence violation detection
- [ ] Re-provision with different municipality
- [ ] Verify boundary updates correctly

---

## Files Modified

### Backend:
- ✅ `backend/api/views.py` - Added `get_device_boundary()` endpoint
- ✅ `backend/api/urls.py` - Added route

### ESP32 (TODO):
- `Arduino/esp32/esp32.ino` - Needs dynamic polygon implementation

