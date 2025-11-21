# ESP32 GPS Tracking System - Testing Guide

## ✅ Changes Applied

All enhanced components have been successfully integrated into your existing codebase:

### 1. **MapView.jsx** - Enhanced
- ✅ Multiple device tracking with Map data structure
- ✅ 8-minute offline detection (down from 10 minutes)
- ✅ 4-minute reconnecting threshold
- ✅ Exponential backoff WebSocket reconnection
- ✅ Document Visibility API integration
- ✅ Enhanced device merging to prevent disappearing markers

### 2. **TrackerHistoryTimeline.jsx** - Cleaned
- ✅ Removed status indicators (online/offline/reconnecting)
- ✅ Shows only movements, boundary crossings, and violations
- ✅ Enhanced timestamp formatting with relative times
- ✅ 2-minute auto-refresh interval
- ✅ Filter options: Movements, Violations, All

### 3. **Backend Services** - New
- ✅ Created `api/services/tracker_status_service.py`
- ✅ Created `api/services/__init__.py`
- ✅ Updated `api/consumers.py` with 8-minute offline threshold
- ✅ Added new API endpoints for status monitoring

## 🚀 How to Test

### Step 1: Start the Backend

```bash
# Navigate to backend directory
cd backend

# Activate virtual environment (if not already active)
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Start the Django development server
python manage.py runserver 0.0.0.0:8000
```

### Step 2: Start the Frontend

```bash
# Open a new terminal
# Navigate to frontend directory
cd frontend

# Install dependencies (if needed)
npm install

# Start the development server
npm run dev
```

The frontend should start at `http://localhost:5173` (or the port shown in terminal).

## 🧪 Test Scenarios

### Test 1: Multiple Device Tracking

1. Open the BirukBilug Tracking page
2. Look at the map - you should see ALL active ESP32 devices
3. Wait for GPS updates to come in via WebSocket
4. **Expected**: New device markers should appear without removing existing ones
5. **Verification**: Count the devices - all should remain visible

### Test 2: Offline Detection (8 Minutes)

1. Find a device that hasn't sent data recently
2. Check the marker color:
   - **Green/Blue**: Online (< 4 minutes old)
   - **Orange/Yellow**: Reconnecting (4-8 minutes old)
   - **Gray**: Offline (> 8 minutes old)
3. **Expected**: Status should match the actual time since last update

### Test 3: Tracker History (Clean Version)

1. Click on any boat marker on the map
2. Click "View History" button
3. **Expected Results**:
   - ❌ No "Tracker Online" events
   - ❌ No "Tracker Offline" events
   - ❌ No "Tracker Reconnecting" events
   - ✅ Only see boundary crossings
   - ✅ Only see violations
   - ✅ Only see movement events
4. Check timestamps - should show relative time (e.g., "2h ago", "Just now")

### Test 4: WebSocket Performance

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for WebSocket messages: `[WebSocket] Connected for GPS updates`
4. Switch to another tab for 1 minute
5. Switch back to the tracking tab
6. **Expected**: WebSocket should reconnect automatically
7. **No expected errors** related to WebSocket flooding

### Test 5: Tab Switching (Map Glitch Fix)

1. Open the tracking map
2. Switch to another browser tab
3. Wait 30 seconds
4. Switch back to the tracking tab
5. **Expected**: Map should render correctly without glitches
6. Markers should still be in correct positions

### Test 6: Status Monitoring API

Test the new backend endpoints:

```bash
# Get status summary for all trackers
curl http://localhost:8000/api/tracker-status/summary/

# Get specific tracker status
curl http://localhost:8000/api/tracker-status/SJU-001/

# Check provisioning status
curl http://localhost:8000/api/provisioning-status/SJU-001/
```

**Expected Response** (summary):
```json
{
  "timestamp": "2025-11-20T21:30:00Z",
  "total_trackers": 5,
  "online": 2,
  "reconnecting": 1,
  "offline": 2,
  "details": {
    "online": ["SJU-001", "SJU-002"],
    "reconnecting": ["SJU-003"],
    "offline": ["SJU-004", "SJU-005"]
  },
  "offline_trackers": [...],
  "critical_offline": [...]
}
```

## 📊 Performance Metrics

Monitor these in browser DevTools:

### Console Output to Look For:
```
[WebSocket] Connected for GPS updates
[MAP] Active devices: 5
[WebSocket] Disconnected: 1006
[WebSocket] Reconnecting in 1000ms
```

### What NOT to See:
```
❌ WebSocket error storms (repeated errors)
❌ "Maximum update depth exceeded" errors
❌ Map rendering errors
❌ Missing device markers
```

## 🔍 Troubleshooting

### Issue: WebSocket won't connect
**Check**:
1. Backend is running on port 8000
2. Frontend `.env` has correct `VITE_WS_HOST=localhost` and `VITE_WS_PORT=8000`
3. Browser console shows connection attempts

**Fix**: Check firewall settings, ensure backend is accessible

### Issue: Devices disappearing from map
**Check**: Browser console for errors
**Expected**: Should NOT happen anymore - devices use Map with unique IDs

### Issue: Status events still showing in history
**Check**: The filter is set to "Movements" or "All"
**Expected**: Status events (online/offline/reconnecting) should be filtered out

### Issue: Offline detection not working
**Check**:
1. Backend `consumers.py` has `threshold_seconds = 480`
2. Device actually hasn't sent data in 8+ minutes
3. Backend logs show correct age calculation

## 📝 Verification Checklist

- [ ] Multiple ESP32 devices visible on map simultaneously
- [ ] No devices disappearing when new GPS data arrives
- [ ] Offline detection shows correct status after 8 minutes
- [ ] Tracker history doesn't show status events
- [ ] Timestamps in history show relative time ("2h ago")
- [ ] WebSocket reconnects automatically after tab switch
- [ ] Map doesn't glitch when switching tabs
- [ ] New API endpoints respond correctly
- [ ] Filter options work (Movements, Violations, All)
- [ ] Console shows no WebSocket error storms

## 🎯 Success Criteria

Your system is working correctly if:

1. ✅ All active ESP32 devices remain visible on map
2. ✅ Devices show correct offline status after 8 minutes
3. ✅ History timeline is clean (no status events)
4. ✅ WebSocket reconnects gracefully
5. ✅ No map glitches or rendering issues
6. ✅ Performance is smooth with multiple devices

## 🐛 Reporting Issues

If you encounter problems, please note:
1. Which test scenario failed
2. Browser console errors (screenshot)
3. Network tab showing WebSocket connection status
4. Django server logs

## 📚 Additional Resources

- **Backend Tests**: Run `python manage.py test api.tests.test_offline_detection`
- **Component Locations**:
  - MapView: `frontend/src/maps/MapView.jsx`
  - TrackerHistory: `frontend/src/components/Tracker/TrackerHistoryTimeline.jsx`
  - Status Service: `backend/api/services/tracker_status_service.py`
  - WebSocket Consumer: `backend/api/consumers.py`

---

**Ready to Test!** Start both servers and follow the test scenarios above.
