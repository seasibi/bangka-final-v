# Violation & Status Logic Fixes - Complete

## Issues Fixed

### **Issue 1: Repeated Violations Fixed - ONE PER DAY** ✅
**Problem:** ESP32 kept triggering violations every 15 minutes because `g_violation_triggered` flag was not being persisted to NVS.

**Root Cause:** The violation flag was being reset on every reboot/reconnection, so the tracker would trigger a new violation alert every time it checked the 15-minute idle timer.

**Fix Applied:**
1. Added `g_violation_triggered` and `g_violation_timestamp` to NVS save/load functions
2. Added 24-hour cooldown check - only ONE violation per municipality per DAY
3. Save violation flag and timestamp immediately when triggered
4. Load both from NVS on boot

**Files Modified:**
- `Arduino/esp32/esp32.ino` (lines 213, 1480, 1499, 1514-1527, 1530)

**Code Changes:**
```cpp
// Save violation flag to NVS
geoPrefs.putBool("violated", g_violation_triggered);

// Load violation flag from NVS (not reset to false!)
g_violation_triggered = geoPrefs.getBool("violated", false);

// Save immediately after triggering
g_violation_triggered = true;
geofence_save_state();  // CRITICAL: Persist to NVS immediately
```

---

### **Issue 2: Tracker Shows "Reconnecting" When Actually Offline** ✅
**Problem:** Trackers stuck showing "reconnecting" status even after 8+ minutes of no data, when they should show "offline".

**Root Cause:** Thresholds were too short and inconsistent across backend components.

**Fix Applied:**
1. Updated reconnecting threshold from 3 minutes to 5 minutes
2. Updated offline threshold consistently to **8 minutes** across all backend views
3. Map view now forces offline after 8 minutes (was 5 minutes)

**Files Modified:**
- `backend/api/views.py`
  - `tracker_history()` - lines 3539, 3579, 3599, 3620, 3650
  - `gps_geojson()` - line 1786

**New Threshold Logic:**
```
0-5 minutes:     Online ✅
5-8 minutes:     Reconnecting 🔄 (attempting to reconnect)
8+ minutes:      Offline ❌ (no signal)
```

---

## Testing Instructions

### **Test 1: Verify One-Time Violation**

1. **Upload updated ESP32 firmware**
   ```
   Arduino IDE → Upload to ESP32
   ```

2. **Provision tracker** (if needed):
   ```
   DEVICE_ID=SJU-0001
   TOKEN=your-token
   PROVISION
   ```

3. **Trigger violation** (on land for testing):
   - Place tracker on land (outside San Juan land boundary)
   - Wait for tracker to be idle (< 50m movement) for 15 minutes
   - **Expected:** Beep + LCD alert + Serial message "GEOFENCE VIOLATION"

4. **Verify no repeated violations (same day)**:
   - Keep tracker idle in same location
   - Wait another 15 minutes
   - **Expected:** No new beep/alert (violation already triggered today)
   - Serial should show: `[GEOFENCE] Violation already triggered today, cooldown: X hours remaining`

5. **Test 24-hour cooldown**:
   - Stay outside boundary for 24+ hours (or adjust system time for testing)
   - After 24 hours, wait 15 mins idle again
   - **Expected:** `[GEOFENCE] 24-hour cooldown expired, allowing new violation`
   - New violation triggers (beep/alert)

6. **Test violation reset (same day)**:
   - Move tracker back inside boundary (San Juan land area)
   - **Expected:** Serial shows `[GEOFENCE] Re-entered polygon; timers cleared.`
   - Move outside again and wait 15 mins
   - **Expected:** NO violation (24-hour cooldown still active)

---

### **Test 2: Verify Status Transitions**

#### **A. Test Reconnecting Status (5-8 minutes)**

1. **Start with online tracker:**
   - Tracker should show green marker on map

2. **Stop GPS posting** (power off tracker or disconnect antenna):
   - Wait 5+ minutes
   - **Expected:** Tracker marker turns yellow "Reconnecting"
   - Timeline shows: "Tracker Reconnecting (intermittent signal 5+ minutes)"

3. **Continue waiting:**
   - Wait until 8 minutes total
   - **Expected:** Still shows "Reconnecting"

#### **B. Test Offline Status (8+ minutes)**

4. **Continue with tracker off:**
   - Wait until 8+ minutes total
   - **Expected:** Tracker marker turns gray "Offline"
   - Timeline shows: "Tracker Offline (no data for 8+ minutes)"

5. **Verify status persistence:**
   - Refresh browser
   - **Expected:** Still shows "Offline" (not stuck on "Reconnecting")

#### **C. Test Reconnect**

6. **Power on tracker:**
   - Wait for GPS fix and data post
   - **Expected:** 
     - Marker immediately turns green
     - Timeline shows: "Tracker Reconnected"
     - Then shows: "Tracker Online"

---

### **Test 3: Backend Status Consistency**

1. **Check map view** (`/api/gps/geojson/`):
   ```bash
   curl http://localhost:8000/api/gps/geojson/
   ```
   - Verify `status` field matches marker color:
     - `online` = green
     - `reconnecting` = yellow  
     - `offline` = gray

2. **Check tracker history** (`/api/tracker-history/SJU-0001/`):
   ```bash
   curl http://localhost:8000/api/tracker-history/SJU-0001/
   ```
   - Verify status events match map view
   - Verify timestamps are chronological
   - Verify "offline" events appear after 10 mins

3. **Check WebSocket updates:**
   - Open browser DevTools → Network → WS
   - Watch real-time status updates
   - Verify status changes propagate immediately

---

## Expected Results Summary

### **Violation Behavior:**
✅ **One violation per municipality PER DAY** - 24-hour cooldown between alerts
✅ **Violation persists** - Survives reboot/reconnection
✅ **24-hour cooldown** - After 24 hours, can trigger again in same location
✅ **Movement resets timer** - Moving >50m resets idle countdown
✅ **Entering boundary** - Clears idle timer but cooldown persists

### **Status Transitions:**
✅ **0-5 min:** Online (green marker)
✅ **5-8 min:** Reconnecting (yellow marker)
✅ **8+ min:** Offline (gray marker)
✅ **Reconnect:** Green marker immediately on data receipt

### **Cross-Component Consistency:**
✅ **Map view** - Shows correct status based on GPS age
✅ **Timeline** - Shows correct status events with proper thresholds
✅ **WebSocket** - Broadcasts status changes in real-time
✅ **Frontend** - Displays consistent status across all views

---

## Technical Details

### **ESP32 NVS Storage:**
```
Namespace: "geofence"
Keys:
  - outside: bool           (inside/outside polygon)
  - idleStart: uint32       (Unix timestamp when idle started)
  - lastLat: float          (reference position latitude)
  - lastLng: float          (reference position longitude)
  - hasLast: bool           (has reference position)
  - lastUnix: uint32        (last GPS Unix time)
  - violated: bool          ✨ NEW - prevents repeat violations
  - violTime: uint32        ✨ NEW - timestamp of last violation (24hr cooldown)
  - poly_verts: uint        (number of polygon vertices)
  - poly_lat_N: double      (latitude of vertex N)
  - poly_lng_N: double      (longitude of vertex N)
```

### **Backend Status Thresholds:**
```python
# tracker_history() and gps_geojson()
reconnect_threshold = timedelta(minutes=5)   # Changed from 3
offline_threshold = timedelta(minutes=8)     # Changed from 10 to 8
```

---

## Rollback Instructions

If issues occur, revert these changes:

### **ESP32:**
```cpp
// In geofence_load_state(), line 1498:
// Change back to:
g_violation_triggered = false;  // re-arm on boot
// Remove: g_violation_timestamp = geoPrefs.getULong("violTime", 0);

// Remove from geofence_save_state(), line 1480:
// Remove: geoPrefs.putULong("violTime", g_violation_timestamp);
// Remove: geoPrefs.putBool("violated", g_violation_triggered);

// Remove from geofence_trigger_violation(), lines 1514-1527:
// Remove entire 24-hour cooldown check block
// Remove: g_violation_timestamp = nowUnix;
```

### **Backend:**
```python
# In tracker_history(), line 3539:
reconnect_threshold = timedelta(minutes=3)  # Revert to 3
offline_threshold = timedelta(minutes=10)   # Revert to 10

# In gps_geojson(), line 1786:
threshold_min = int(request.GET.get("threshold", 10))  # Revert to 10
```

---

## Notes

- **Land boundary testing:** Backend is currently using `LandBoundary` instead of `MunicipalityBoundary` for easier land-based testing
- **Production deployment:** Switch back to `MunicipalityBoundary` (water boundaries) in `backend/api/views.py` line 2757
- **Violation cooldown (device):** ESP32 has 60-second beep cooldown to prevent audio spam
- **Violation cooldown (global):** 24-hour cooldown per municipality - only ONE violation per day
- **NVS persistence:** All geofence state survives power loss and reboots
- **Status thresholds:** 0-5min = Online, 5-8min = Reconnecting, 8+min = Offline

---

## Deployment Checklist

Before deploying to production:

- [ ] Test violation triggers once per municipality per day
- [ ] Test 24-hour cooldown (no repeat violations same day)
- [ ] Test status transitions (online → reconnecting @ 5min → offline @ 8min)
- [ ] Verify tracker history shows correct events with 8-minute offline
- [ ] Switch backend from LandBoundary to MunicipalityBoundary
- [ ] Test with multiple trackers simultaneously
- [ ] Verify WebSocket broadcasts status correctly (8-min offline)
- [ ] Verify entering boundary clears idle timer but not cooldown
- [ ] Test violation after 24+ hours in same zone (should allow new violation)
- [ ] Document new behavior for end users (one violation per day)

