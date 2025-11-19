# Fix Applied: Coastal Municipality Tracker Registration

## Issue
San Gabriel municipality was marked as coastal in the database, but couldn't be selected when adding trackers because the backend had a **hardcoded list** of allowed municipalities that didn't include it.

## Root Cause
In `backend/api/views.py`, the `BirukbilugTrackerViewSet.create()` method was checking against a hardcoded `ALLOWED_MUNICIPALITIES` set instead of dynamically querying the `Municipality` model's `is_coastal` field.

## Fix Applied ✅

### Changes Made:
1. **Updated tracker validation** (lines 1515-1530 in `backend/api/views.py`)
   - Removed hardcoded `ALLOWED_MUNICIPALITIES` check
   - Now dynamically queries `Municipality.objects.filter(is_coastal=True, is_active=True)`
   - Uses case-insensitive matching for municipality names

2. **Updated prefix lookup** (lines 1484-1495 in `backend/api/views.py`)
   - Now fetches prefix from the `Municipality` model
   - Falls back to hardcoded dict if database lookup fails

### Benefits:
- ✅ Any municipality marked as coastal can now register trackers
- ✅ No need to update backend code when adding new coastal municipalities
- ✅ Single source of truth: the `Municipality` model
- ✅ Case-insensitive municipality name matching

## How to Test

### 1. Restart Backend Server (REQUIRED)
```bash
# If your backend is running, stop it (Ctrl+C) and restart:
cd backend
python manage.py runserver
```

### 2. Restart Frontend (if running)
```bash
# If your frontend is running, stop it (Ctrl+C) and restart:
cd frontend
npm run dev
```

### 3. Test Adding a Tracker
1. Open your app in the browser
2. Navigate to "Add Tracker" page
3. Click on the Municipality dropdown
4. **Verify San Gabriel appears in the list**
5. Select San Gabriel
6. Submit the form
7. **Verify the tracker is created with prefix "SGB-xxxx"**

### 4. Hard Refresh Browser
If San Gabriel still doesn't appear:
- Press `Ctrl + Shift + R` (Windows/Linux)
- Or `Cmd + Shift + R` (Mac)
- Or open DevTools (F12) → Right-click refresh → "Empty Cache and Hard Reload"

## Verification Commands

### Check San Gabriel is Coastal in Database:
```bash
cd backend
python manage.py shell
```

Then in the shell:
```python
from api.models import Municipality
sg = Municipality.objects.get(name="San Gabriel")
print(f"Name: {sg.name}")
print(f"Is Coastal: {sg.is_coastal}")
print(f"Prefix: {sg.prefix}")
print(f"Is Active: {sg.is_active}")
```

Expected output:
```
Name: San Gabriel
Is Coastal: True
Prefix: SGB
Is Active: True
```

### Test the API Endpoint:
```bash
# Get all coastal municipalities
curl http://localhost:8000/api/municipalities/coastal/
```

San Gabriel should appear in the results.

## Files Modified
- `backend/api/views.py` - Lines 1484-1530
  - Updated `_prefix_for()` method to use database
  - Updated `create()` method to validate coastal status dynamically

## Additional Notes

### Current Coastal Municipalities
All these municipalities can now register trackers:
- Agoo (AGO)
- Aringay (ARI)
- Bacnotan (BAC)
- Balaoan (BAL)
- Bangar (BNG)
- Bauang (BAU)
- Caba (CAB)
- Luna (LUN)
- Rosario (ROS)
- City of San Fernando (CSF)
- **San Gabriel (SGB)** ← Now working!
- San Juan (SJU)
- Santo Tomas (STO)
- Sudipen (SUD)

### To Add More Coastal Municipalities
Simply mark them as coastal in the Municipality Management panel or via Django admin - no code changes needed!

## Troubleshooting

### If San Gabriel still doesn't appear:
1. ✅ Verify backend server is restarted
2. ✅ Hard refresh browser
3. ✅ Check browser console for errors
4. ✅ Verify San Gabriel is marked as `is_coastal=True` in database
5. ✅ Check the API response: `http://localhost:8000/api/municipalities/coastal/`

### If you get "Only coastal municipalities allowed" error:
1. Check that San Gabriel has `is_active=True`
2. Verify the municipality name matches exactly (case-insensitive)
3. Check backend logs for any errors

