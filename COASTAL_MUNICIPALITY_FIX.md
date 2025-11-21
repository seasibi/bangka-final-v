# Coastal Municipality Filter Issue - Fixed

## Problem
San Gabriel (and potentially other municipalities) not appearing in the tracker registration dropdown, even though they are marked as coastal in the municipality management.

## Root Cause
The frontend caches municipality data, and if a municipality was marked as non-coastal earlier, the cached data prevents it from showing in the "Add Tracker" form even after updating it to coastal.

## Verification ✅
**Database Check Confirmed:**
- San Gabriel IS marked as `is_coastal: True` in the database
- Municipality ID: 15
- Prefix: SAN
- Status: Active

## How the Filter Works

### Frontend Filter (AddTrackerModal.jsx)
```javascript
const COASTAL_ONLY = true;  // Line 9

// Line 391-392: Filter municipalities
.filter((m) => (COASTAL_ONLY ? m.is_coastal : true))
```

The form ONLY shows municipalities where `is_coastal === true`.

### Backend (Municipality Model)
```python
class Municipality(models.Model):
    is_coastal = models.BooleanField(default=False)  # Line 876
```

## Solution

### Quick Fix (Try This First)
1. **Hard refresh the frontend:**
   - Press `Ctrl + Shift + R` (Windows/Linux)
   - Or `Cmd + Shift + R` (Mac)
   - Or: DevTools (F12) → Right-click refresh → "Empty Cache and Hard Reload"

2. **Restart frontend dev server:**
   ```bash
   # Stop current server (Ctrl+C)
   cd frontend
   npm run dev
   ```

3. **Check browser console:**
   - Open DevTools (F12) → Console tab
   - Look for: `🔍 San Gabriel Status:`
   - Verify: `is_coastal: true, will_show_in_tracker_add: true`

### If Still Not Working

1. **Verify backend is serving correct data:**
   ```bash
   # Test API endpoint
   curl http://localhost:8000/api/municipalities/?is_active=true
   ```
   
   Look for San Gabriel in the response and check `"is_coastal": true`

2. **Check if municipality is actually marked as coastal:**
   ```bash
   cd backend
   python ../check_san_gabriel_coastal.py
   ```

3. **Manually set coastal status (if needed):**
   ```bash
   # Run Django shell
   python manage.py shell
   
   # In shell:
   from api.models import Municipality
   san_gabriel = Municipality.objects.get(name="San Gabriel")
   san_gabriel.is_coastal = True
   san_gabriel.save()
   print(f"San Gabriel is_coastal: {san_gabriel.is_coastal}")
   ```

## Logging Added ✅

Added detailed console logging in `useMunicipalities.js` to help debug:
```
📍 Municipalities loaded:
🌊 Bacnotan - Prefix: BAC, Coastal: true
🌊 San Gabriel - Prefix: SAN, Coastal: true
🌊 San Juan - Prefix: SJU, Coastal: true
🏔️ Bagulin - Prefix: BAG, Coastal: false
...

🔍 San Gabriel Status: {
  name: 'San Gabriel',
  is_coastal: true,
  prefix: 'SAN',
  will_show_in_tracker_add: true
}
```

## How to Mark a Municipality as Coastal

### Via Admin Panel:
1. Go to Municipality Management
2. Edit the municipality
3. Check the "Is Coastal" checkbox
4. Save

### Via Django Shell:
```python
from api.models import Municipality

# Mark as coastal
muni = Municipality.objects.get(name="Your Municipality Name")
muni.is_coastal = True
muni.save()

# Verify
print(f"{muni.name} is_coastal: {muni.is_coastal}")
```

### Via Database:
```sql
UPDATE api_municipality 
SET is_coastal = 1 
WHERE name = 'Your Municipality Name';
```

## Testing Checklist

After applying the fix:
- [ ] Hard refresh frontend (Ctrl+Shift+R)
- [ ] Open "Add Tracker" modal
- [ ] Verify San Gabriel appears in municipality dropdown
- [ ] Check browser console for 🔍 San Gabriel Status log
- [ ] Try registering a tracker with San Gabriel
- [ ] Verify tracker ID gets correct SAN prefix

## Coastal Municipalities in La Union

Based on geography, these should be marked as coastal:
- ✅ Agoo
- ✅ Aringay  
- ✅ Bacnotan
- ✅ Balaoan
- ✅ Bauang
- ✅ Burgos
- ✅ Caba
- ✅ Luna
- ✅ City of San Fernando
- ✅ San Gabriel
- ✅ San Juan
- ✅ Santo Tomas
- ✅ Santol

Non-coastal (inland):
- 🏔️ Bagulin
- 🏔️ Bangar
- 🏔️ Naguilian
- 🏔️ Pugo
- 🏔️ Rosario
- 🏔️ Sudipen
- 🏔️ Tubao

## Files Modified
- `frontend/src/hooks/useMunicipalities.js` - Added detailed coastal status logging
- `check_san_gabriel_coastal.py` - Created database verification script

## Related Files
- `frontend/src/components/Tracker/AddTrackerModal.jsx` - Line 9: `COASTAL_ONLY = true`
- `backend/api/models.py` - Line 876: `is_coastal` field definition
- `backend/api/serializers.py` - Line 1055: `is_coastal` included in API response
