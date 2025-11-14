# 🚤 Boat GPS Simulation Test

## Overview
This simulation test creates **3 boats** traveling from **San Fernando to San Juan**, triggering boundary violations and testing the tracker history timeline feature.

## What This Tests
- ✅ Multiple boats showing on map simultaneously
- ✅ Boundary crossing detection (San Fernando → San Juan)
- ✅ Violation alerts (15+ minutes in wrong municipality)
- ✅ Tracker history timeline with all events
- ✅ Offline status detection (after 10+ minutes no data)
- ✅ Clickable boat markers with popups
- ✅ "View Tracker History" button functionality

## Prerequisites

### 1. Backend Running
```powershell
cd backend
python manage.py runserver
```

### 2. Frontend Running
```powershell
cd frontend
npm run dev
```

### 3. Database Must Have:
- San Fernando municipality in database
- San Juan municipality in database
- Boats with IDs 1, 2, 3 registered (or simulation will create GPS data for these IDs)

## Running the Simulation

### Step 1: Navigate to Backend Directory
```powershell
cd C:\Users\rhyi\OneDrive\Desktop\BANGKA SYSTEM\bangka-git-v-55-1-abcd\backend
```

### Step 2: Run the Simulation Script
```powershell
python test_boat_simulation.py
```

### Step 3: Watch the Console
You'll see:
```
🚤 BOAT GPS SIMULATION TEST
========================================================
📍 Route: San Fernando → San Juan
🚤 Boats: 3
⏱️  Starting simulation...
```

The simulation runs through 4 phases:
- **Phase 1**: Initial positions (all boats in San Fernando)
- **Phase 2**: Moving to San Juan (~40 seconds, 20 waypoints)
- **Phase 3**: Dwelling in San Juan (16 minutes to trigger violations)
- **Phase 4**: Offline test (stops sending data for 11 minutes)

## Testing Steps

### During Phase 1-2 (First 1 minute)
1. Open your browser to BirukBilug Tracking page
2. You should see **3 boat markers** appearing on the map
3. Watch them move from San Fernando to San Juan
4. All 3 boats should be visible (different colors/positions)

### During Phase 3 (Minutes 1-17)
1. Boats will stay in San Juan municipality
2. After 15 minutes, violations should be triggered
3. Boat markers might turn **red** (violation color)
4. Check the Notifications panel for boundary violation alerts

### Testing Tracker History
1. **Click any boat marker** on the map
2. **Popup should appear** with boat details
3. **Click "View Tracker History" button**
4. **Timeline should slide up** from right side
5. **Check for these events**:
   - ✅ **Registered** - Green check icon
   - ✅ **Online** - Green wifi icon
   - ✅ **Boundary Crossing** - Blue pin icon (San Fernando → San Juan)
   - ✅ **Violation** - Red warning icon (after 15+ min in San Juan)

### After Phase 4 (After ~28 minutes)
1. Wait 11+ minutes after simulation stops
2. Refresh the map
3. Boats should show as **OFFLINE** (gray markers)
4. Click an offline boat marker
5. Popup should still work
6. Click "View Tracker History"
7. Timeline should show **Offline** event with gray wifi-off icon

## Expected Timeline Events

```
🕒 Tracker History Timeline
├── 📅 Today
│   ├── ⚠️  Violation (RED) - "Boundary Violation"
│   │   └── Stayed in San Juan for 16 minutes
│   ├── 📍 Boundary Crossing (BLUE) - "Crossed boundary"
│   │   └── San Fernando → San Juan
│   ├── ✅ Online (GREEN) - "Tracker is online"
│   │   └── Started transmitting data
│   └── ✅ Registered (GREEN) - "Tracker Registered"
│       └── Tracker TEST001 registered
```

## Troubleshooting

### ❌ "Only 1 boat shows on map"
**FIXED!** The backend now gets the latest GPS point **per boat** instead of just the latest 100 points total.

### ❌ "Can't click boat marker"
**FIXED!** Offline boat markers now have `pointer-events: auto` and popups are clickable.

### ❌ "Tracker history button doesn't work"
**FIXED!** Event listener now uses capture phase and checks for button clicks properly.

### ❌ "No violations triggered"
- Make sure boats are registered to **San Fernando** municipality
- Check that they stay in San Juan for 15+ minutes
- Check console logs for "Boundary crossing detected" messages

### ❌ "Simulation fails with error"
- Check that backend is running on `http://localhost:8000`
- Verify database has municipalities: San Fernando, San Juan
- Check backend console for error messages

## Cleanup After Test

To remove test GPS data:
```python
# In Django shell (python manage.py shell)
from api.models import GpsData, BoundaryCrossing, BoundaryViolationNotification

# Delete test GPS data
GpsData.objects.filter(boat_id__in=[1, 2, 3]).delete()

# Delete test boundary crossings
BoundaryCrossing.objects.filter(boat_id__in=[1, 2, 3]).delete()

# Delete test violations
BoundaryViolationNotification.objects.filter(boat__boat_id__in=[1, 2, 3]).delete()
```

## Simulation Parameters

You can modify these in `test_boat_simulation.py`:

```python
# Number of waypoints (more = smoother movement)
steps = 20

# Interval between GPS updates (seconds)
time.sleep(2)

# Violation dwell time (minutes)
for minute in range(16):  # Change 16 to test different durations
```

## Success Criteria

✅ All 3 boats visible on map simultaneously  
✅ Boats move smoothly from San Fernando to San Juan  
✅ Boundary crossing event logged  
✅ Violation triggered after 15 minutes  
✅ Offline status after 10+ minutes no data  
✅ Boat markers clickable (including offline boats)  
✅ Popup shows boat details correctly  
✅ "View Tracker History" button opens timeline  
✅ Timeline shows all event types with correct icons and colors  

## Support

If issues persist:
1. Check browser console (F12) for JavaScript errors
2. Check backend console for Python errors
3. Verify WebSocket connection is working
4. Test with hard refresh (Ctrl+Shift+R)
