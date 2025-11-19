# Fix SAN-0004 Boundary Issue

## Problem
Your ESP32 (SAN-0004) is getting a 404 error when trying to fetch boundary data.

## Important Notice
The error message you're seeing:
```
{"error":"No boundary data available for municipality"}
```

This is from the **OLD CODE**! This means your backend server **wasn't restarted** with the new fix.

---

## Step-by-Step Fix

### Step 1: Verify Backend Changes Were Applied

Check if the file was saved:
```bash
cd backend/api
grep -A 5 "No boundary polygon found" views.py
```

**Should show:**
```python
'error': f'No boundary polygon found for {municipality_name}',
```

**If it still shows old error:** The file wasn't saved or you're running old code.

### Step 2: **RESTART BACKEND** (Critical!)

Stop your current backend server (Ctrl+C), then:

```bash
cd backend
python manage.py runserver
```

**Wait for:**
```
Starting development server at http://127.0.0.1:8000/
```

### Step 3: Verify SAN-0004 Tracker Exists

```bash
cd backend
python ../debug_san_0004.py
```

This will show:
- ✅ If tracker exists
- ✅ If it has a municipality set
- ✅ If boundary data exists for that municipality
- ❌ Any issues found

### Step 4: Common Issues & Solutions

#### Issue A: Tracker Doesn't Exist
**Check:**
```bash
python manage.py shell
```
```python
from api.models import BirukbilugTracker
BirukbilugTracker.objects.filter(BirukBilugID="SAN-0004").exists()
```

**If False:**
You need to create the tracker in admin panel first!

#### Issue B: Tracker Has No Municipality
**Fix:**
```python
from api.models import BirukbilugTracker
tracker = BirukbilugTracker.objects.get(BirukBilugID="SAN-0004")
tracker.municipality = "San Gabriel"
tracker.save()
print(f"Set municipality to: {tracker.municipality}")
```

#### Issue C: Municipality Name Mismatch
**Check exact names:**
```python
from api.models import LandBoundary
# Show all land boundary names
for lb in LandBoundary.objects.all():
    print(f"'{lb.name}'")

# Check if San Gabriel exists
LandBoundary.objects.filter(name__iexact="San Gabriel").exists()
```

**If names don't match exactly:**
```python
# Option 1: Update tracker to match boundary
tracker = BirukbilugTracker.objects.get(BirukBilugID="SAN-0004")
tracker.municipality = "San Gabriel"  # Use EXACT name from LandBoundary
tracker.save()

# Option 2: Update boundary to match tracker
lb = LandBoundary.objects.get(name="San Gabriel")
lb.name = tracker.municipality  # Use name from tracker
lb.save()
```

### Step 5: Test the Endpoint Directly

After restart:
```bash
curl http://localhost:8000/api/device-boundary/SAN-0004/
```

**Expected (Success):**
```json
{
  "status": "ok",
  "device_id": "SAN-0004",
  "municipality": {
    "name": "San Gabriel",
    ...
  },
  "geofence": {
    "vertices": 9,
    "polygon": [[16.6137, 120.3867], ...]
  }
}
```

**Expected (New Error Format - if boundary missing):**
```json
{
  "error": "No boundary polygon found for San Gabriel",
  "device_id": "SAN-0004",
  "municipality": "San Gabriel",
  "hint": "Add boundary data via admin panel"
}
```

**If you still see old error:**
```json
{"error": "No boundary data available for municipality"}
```
→ **Backend NOT restarted with new code!**

### Step 6: Re-Provision ESP32

After confirming endpoint works:
```
PROVISION
```

**Expected:**
```
[GEOFENCE] HTTP Status: 200
[GEOFENCE] ✅ Loaded San Gabriel boundary: 9 vertices
[PROV] ✅ Provisioning complete with boundary!
```

---

## Quick Checklist

Before provisioning ESP32:

- [ ] Backend file saved with new code
- [ ] Backend server restarted
- [ ] Tracker SAN-0004 exists in database
- [ ] Tracker has municipality set (e.g., "San Gabriel")
- [ ] LandBoundary exists for that municipality
- [ ] Names match exactly (case-insensitive)
- [ ] Endpoint returns 200 when tested with curl

---

## Still Not Working?

Run the debug script and share the output:
```bash
python debug_san_0004.py
```

Also test the endpoint:
```bash
curl http://localhost:8000/api/device-boundary/SAN-0004/ | jq
```

Share both outputs and I can help diagnose!

---

## Most Likely Issue

Based on your error message still showing the old format, **the backend wasn't restarted** with the new code.

**Quick fix:**
1. Stop backend (Ctrl+C)
2. Restart: `python manage.py runserver`
3. Wait for server to fully start
4. Test: `curl http://localhost:8000/api/device-boundary/SAN-0004/`
5. Re-provision ESP32: `PROVISION`

