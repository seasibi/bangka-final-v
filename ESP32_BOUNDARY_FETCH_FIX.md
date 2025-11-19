# ESP32 Boundary Fetch Fix - Auto-Fetch After Modem Ready

## Problem Fixed

**Before:**
- ❌ PROVISION command tried to fetch boundary immediately
- ❌ Modem wasn't initialized yet during provisioning
- ❌ PPP connection failed
- ❌ Boundary never saved to NVS
- ❌ Had to manually re-provision after reboot

**After:**
- ✅ PROVISION only saves credentials
- ✅ Boundary fetches AFTER modem is initialized
- ✅ Auto-fetch on boot if no boundary exists
- ✅ Manual FETCH_BOUNDARY command available
- ✅ Boundary properly saved to NVS

---

## How It Works Now

### New Provisioning Flow

```
1. User sends PROVISION command
   ├─ Saves credentials to NVS ✅
   ├─ Shows "Provisioning complete!"
   └─ ESP32 continues booting...

2. ESP32 initializes modem
   ├─ Power on SIM808
   ├─ Dial PPP connection
   └─ Get IP address ✅

3. AUTO-FETCH (if no boundary)
   ├─ Checks if boundary exists in NVS
   ├─ If missing, fetches from backend
   ├─ Saves polygon to NVS
   └─ Shows "Boundary Loaded!" ✅

4. Ready to track!
```

---

## Changes Made

### 1. Skip Boundary Fetch During PROVISION

**File:** `Arduino/esp32/esp32.ino` (lines 464-476)

```cpp
// OLD CODE:
if (cfg_save()) {
  Serial.println("[PROV] ✅ Credentials stored successfully!");
  // Tried to fetch boundary HERE (modem not ready!)
  if (geofence_fetch_from_backend()) {
    // Would fail because PPP not connected
  }
}

// NEW CODE:
if (cfg_save()) {
  Serial.println("[PROV] ✅ Credentials stored successfully!");
  Serial.println("[PROV] ✅ Provisioning complete!");
  Serial.println("[PROV] Boundary will be fetched after modem initializes...");
  // No boundary fetch here - will happen after modem ready
  return true;
}
```

### 2. Auto-Fetch After Modem Ready

**File:** `Arduino/esp32/esp32.ino` (lines 1747-1760)

```cpp
// In setup(), AFTER modem_dial() and ppp_connect_blocking():

// 3) Auto-fetch boundary if provisioned but no boundary loaded
if (g_provisioned && g_geofence_vertices == 0) {
  Serial.println("[SETUP] Device provisioned but no boundary. Fetching now...");
  lcd_show("Fetching", "Boundary...");
  
  if (geofence_fetch_from_backend()) {
    Serial.println("[SETUP] ✅ Boundary fetched successfully!");
    lcd_show("Boundary", "Loaded!");
  } else {
    Serial.println("[SETUP] ⚠ Boundary fetch failed. Send 'FETCH_BOUNDARY' command to retry.");
    lcd_show("No Boundary", "Send FETCH");
  }
  delay(2000);
}
```

### 3. Added FETCH_BOUNDARY Command

**File:** `Arduino/esp32/esp32.ino` (lines 503-520)

```cpp
} else if (K == "FETCH_BOUNDARY" || K == "FETCH") {
  // Manual command to fetch boundary (after modem is ready)
  if (!g_provisioned) {
    Serial.println("[FETCH] ERROR: Device not provisioned. Run PROVISION first.");
    return false;
  }
  
  Serial.println("[FETCH] Fetching geofence boundary from backend...");
  if (geofence_fetch_from_backend()) {
    Serial.println("[FETCH] ✅ Boundary fetch successful!");
    lcd_show("Boundary", "Loaded!");
    return true;
  } else {
    Serial.println("[FETCH] ❌ Boundary fetch failed");
    Serial.println("[FETCH] Check: Modem power, PPP connection, network");
    lcd_show("Boundary", "Fetch Failed");
    return false;
  }
}
```

---

## How to Use

### Method 1: Automatic (Recommended)

1. **Provision as usual:**
   ```
   DEVICE_ID=SA1-0002
   TOKEN=your-token-here
   PROVISION
   ```

2. **Wait for ESP32 to boot:**
   - Modem initializes
   - PPP connects
   - Boundary auto-fetches
   - Shows "Boundary Loaded!"

3. **Done!** Boundary is saved to NVS.

### Method 2: Manual Fetch

If auto-fetch fails (modem issues, network problems):

1. **Fix modem issue** (power, wiring, SIM card)

2. **After modem is working, send:**
   ```
   FETCH_BOUNDARY
   ```
   or just:
   ```
   FETCH
   ```

3. **Watch for:**
   ```
   [FETCH] Fetching geofence boundary from backend...
   [FETCH] ✅ Boundary fetch successful!
   ```

---

## Expected Serial Output

### During Provisioning:

```
[PROV] Received: DEVICE_ID=SA1-0002
[PROV] Device ID set: SA1-0002
[PROV] Received: TOKEN=0ccbb7c2...
[PROV] OK TOKEN
[PROV] Received: PROVISION
[CFG] Configuration saved successfully.
[PROV] ✅ Credentials stored successfully!
[PROV] ✅ Provisioning complete!
[PROV] Boundary will be fetched after modem initializes...
[PROV] OR send 'FETCH_BOUNDARY' command manually after device boots
[PROV] Provisioning complete! Continuing with startup...
```

### After Modem Initializes:

```
[Modem] Dial...
[PPP] Connected
[SETUP] Device provisioned but no boundary. Fetching now...
[GEOFENCE] Fetching boundary from backend...
[GEOFENCE] GET http://your-server/api/device-boundary/SA1-0002/
[GEOFENCE] HTTP Status: 200
[GEOFENCE] Response length: 456 bytes
[GEOFENCE] ✅ Loaded San Gabriel boundary: 9 vertices
[GEOFENCE] Saved polygon: 9 vertices
[SETUP] ✅ Boundary fetched successfully!
```

### On Next Boot (Boundary Already Saved):

```
[CFG] device_id=SA1-0002 provisioned=yes
[GEOFENCE] Loaded polygon: 9 vertices from NVS
[SETUP] Device provisioned and boundary already loaded. Ready!
```

---

## Troubleshooting

### Issue: "Boundary fetch failed" after modem ready

**Check:**
1. Is backend running?
2. Can you access `http://your-server/api/device-boundary/SA1-0002/` from browser?
3. Does tracker SA1-0002 exist in database?
4. Does municipality have boundary data?

**Debug:**
```bash
# Test endpoint:
curl http://localhost:8000/api/device-boundary/SA1-0002/

# Check tracker in database:
python debug_san_0004.py  # (change tracker ID)
```

### Issue: Modem not responding (AT commands fail)

**Symptoms:**
```
>> AT
!! Expect not found: OK
   Resp: AT
```

**Fixes:**
1. **Power the modem properly** (2A @ 5V)
2. **Press power button** on SIM808 (hold 2-3 seconds)
3. **Check wiring:**
   - ESP32 GPIO 16 → SIM808 TX
   - ESP32 GPIO 17 → SIM808 RX
4. **Insert SIM card** (some modules need it to boot)

### Issue: Boundary still not saved after successful fetch

**Check NVS:**
Send `INFO` command and look for:
```
[INFO] DEVICE_ID=SA1-0002
[INFO] TOKEN=set
[INFO] PROVISIONED=yes
```

Then check on next boot:
```
[GEOFENCE] Loaded polygon: X vertices from NVS
```

If shows 0 vertices, NVS save failed. Try:
1. Erase and re-provision: `RESET` then `PROVISION`
2. Manually fetch: `FETCH_BOUNDARY`

---

## Commands Summary

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `PROVISION` | Save credentials | First time setup |
| `FETCH_BOUNDARY` | Manually fetch boundary | After fixing modem issues |
| `FETCH` | (short form) | Same as FETCH_BOUNDARY |
| `INFO` | Show config | Check provisioning status |
| `RESET` | Erase everything | Start over |

---

## Testing Checklist

After applying this fix:

- [ ] Upload new sketch to ESP32
- [ ] Provision device: `DEVICE_ID=...` `TOKEN=...` `PROVISION`
- [ ] Watch for "Provisioning complete!"
- [ ] Wait for modem to initialize
- [ ] Verify "Boundary fetched successfully!"
- [ ] Reboot ESP32
- [ ] Verify "Loaded polygon: X vertices from NVS"
- [ ] Check GPS tracking works
- [ ] Verify violation detection works

---

## Files Modified

- `Arduino/esp32/esp32.ino`
  - Lines 464-476: Skip boundary fetch during PROVISION
  - Lines 503-520: Added FETCH_BOUNDARY command
  - Lines 1747-1760: Auto-fetch after modem ready
  - Lines 1641, 1785-1787: Added FETCH_BOUNDARY to help text and command handler

---

## Summary

✅ **Fixed:** Boundary now fetches AFTER modem is ready
✅ **Auto-fetch:** On boot if provisioned but no boundary
✅ **Manual retry:** FETCH_BOUNDARY command
✅ **Saves to NVS:** Boundary persists across reboots
✅ **No modem issues:** Provisions successfully even if modem temporarily down

**Result:** Provisioning flow is now reliable and user-friendly! 🎉

---

## Next Steps

1. **Upload the fixed sketch** to your ESP32
2. **Provision the device:**
   ```
   DEVICE_ID=SA1-0002
   TOKEN=your-token
   PROVISION
   ```
3. **Fix modem issues** (if any) - see troubleshooting section
4. **Watch for auto-fetch** after modem connects
5. **Or manually fetch:** `FETCH_BOUNDARY`

The boundary will now be properly saved to NVS and loaded on every boot! 🚀

