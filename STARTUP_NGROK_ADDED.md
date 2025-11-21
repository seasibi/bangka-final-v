# START-ALL.bat - Ngrok Integration

## ✅ Changes Made

Added **Ngrok tunnel** to the automatic startup script for easy ESP32 device connectivity.

---

## 📋 What Was Added

### 1. Ngrok Startup Command
**Location**: After Django Backend, before React Frontend

```batch
REM Start Ngrok Tunnel
echo [STARTING] Ngrok Tunnel...
start "Ngrok Tunnel - KEEP OPEN" cmd /k "echo Ngrok Tunnel && echo ============= && echo Public URL: https://unskilfully-unsoftening-flynn.ngrok-free.dev && echo Tunneling to: http://localhost:8000 && echo. && ngrok http --domain=unskilfully-unsoftening-flynn.ngrok-free.dev --scheme=http 8000"
timeout /t 3 /nobreak >nul
echo [OK] Ngrok Tunnel started
```

### 2. Updated Service List
```
Services running:
  - Redis Server      : Running in separate window
  - Django Backend    : http://127.0.0.1:8000
  - Ngrok Tunnel      : https://unskilfully-unsoftening-flynn.ngrok-free.dev
  - React Frontend    : http://localhost:5173
```

### 3. ESP32 Connection Info
```
ESP32 devices can connect to:
  https://unskilfully-unsoftening-flynn.ngrok-free.dev
```

---

## 🚀 How to Use

### Start Everything (Including Ngrok)
```bash
# Double-click the file or run:
START-ALL.bat
```

This will automatically start:
1. ✅ Redis Server
2. ✅ Django Backend (Port 8000)
3. ✅ **Ngrok Tunnel (Public HTTPS)**
4. ✅ React Frontend (Port 5173)

### What You'll See

**4 separate windows will open:**

1. **Redis Server** - Database/cache
2. **Django Backend - Daphne** - API & WebSocket server
3. **Ngrok Tunnel - KEEP OPEN** - Public tunnel (NEW!)
4. **React Frontend - Vite** - Web interface

---

## 🌐 Ngrok Details

### Public URL
```
https://unskilfully-unsoftening-flynn.ngrok-free.dev
```

### Local Target
```
http://localhost:8000
```

### Configuration
- **Domain**: `unskilfully-unsoftening-flynn.ngrok-free.dev` (reserved domain)
- **Scheme**: HTTP (ngrok adds HTTPS wrapper)
- **Port**: 8000 (Django backend)

### What Ngrok Does
- Creates a secure HTTPS tunnel to your local Django server
- Allows ESP32 devices to connect from anywhere
- No need to manually start ngrok separately
- Shows connection status and requests in its window

---

## 📱 ESP32 Configuration

Your ESP32 devices should connect to:
```cpp
const char* SERVER_HOST = "unskilfully-unsoftening-flynn.ngrok-free.dev";
const int SERVER_PORT = 443;  // HTTPS
const bool USE_HTTPS = true;
```

Or in the Arduino sketch:
```cpp
const char* host = "unskilfully-unsoftening-flynn.ngrok-free.dev";
```

---

## 🛑 Stopping Services

To stop everything:
1. **Close each window** individually, OR
2. **Press Ctrl+C** in each window

**Important**: Keep the Ngrok window open while testing ESP32 devices!

---

## 🔍 Monitoring Ngrok

### In the Ngrok Window
You'll see:
- ✅ Connection status
- 📊 HTTP requests from ESP32 devices
- 🌐 Traffic statistics
- ⚠️ Any connection issues

### Ngrok Web Interface (Optional)
Access at: `http://localhost:4040`
- View all requests in detail
- Replay requests
- Inspect payloads

---

## ⚠️ Important Notes

### 1. **Keep Ngrok Window Open**
- ESP32 devices need this tunnel to communicate
- Closing it will disconnect all remote devices

### 2. **Ngrok Free Plan Limits**
- Reserved domain requires Ngrok account
- May have connection limits on free tier
- Check Ngrok dashboard for usage

### 3. **Firewall Settings**
- Ngrok may trigger firewall prompt on first run
- Allow access for both private and public networks

### 4. **ESP32 Connection**
- Devices will see your backend as HTTPS
- No need to configure certificates on ESP32
- Ngrok handles SSL/TLS termination

---

## 🧪 Testing

### 1. Start Services
```bash
START-ALL.bat
```

### 2. Verify Ngrok Window
Should show:
```
Ngrok Tunnel
=============
Public URL: https://unskilfully-unsoftening-flynn.ngrok-free.dev
Tunneling to: http://localhost:8000

Session Status: online
```

### 3. Test from Browser
```
https://unskilfully-unsoftening-flynn.ngrok-free.dev/api/
```
Should show Django API endpoints

### 4. Test from ESP32
Your devices should now be able to connect and send GPS data!

---

## 📊 Service Startup Order

```
1. Redis Server (2s wait)
   ↓
2. Django Backend (3s wait)
   ↓
3. Ngrok Tunnel (3s wait)  ← NEW!
   ↓
4. React Frontend (2s wait)
   ↓
5. Browser Opens
```

**Total startup time: ~13 seconds**

---

## 🎯 Benefits

### Before (Manual Process)
1. Start Redis manually
2. Start Django manually
3. **Remember to start ngrok manually**
4. Start Frontend manually
5. Configure ESP32 with ngrok URL

### After (Automated)
1. ✅ Double-click `START-ALL.bat`
2. ✅ Everything starts automatically
3. ✅ ESP32 devices can connect immediately
4. ✅ Browser opens to app

---

## 🔧 Troubleshooting

### "ngrok: command not found"
**Solution**: Install ngrok
```bash
# Download from: https://ngrok.com/download
# Or via Chocolatey:
choco install ngrok
```

### "Failed to start tunnel"
**Possible causes**:
1. Port 8000 not available (Django not started)
2. Ngrok account not authenticated
3. Reserved domain not configured

**Solution**:
```bash
# Authenticate ngrok (one-time setup)
ngrok config add-authtoken YOUR_TOKEN
```

### ESP32 Can't Connect
**Check**:
1. ✅ Ngrok window shows "Session Status: online"
2. ✅ Django backend is running (port 8000)
3. ✅ ESP32 has correct URL configured
4. ✅ ESP32 internet connection working

---

## 📝 File Modified

**File**: `START-ALL.bat`

**Lines Changed**:
- Lines 10-11: Updated service list
- Lines 36-41: Added ngrok startup section
- Line 58: Added ngrok to running services list
- Lines 64-65: Added ESP32 connection info

---

## ✨ Ready to Use!

Your startup script now includes ngrok tunnel for seamless ESP32 connectivity!

**Next Steps**:
1. Run `START-ALL.bat`
2. Wait for all services to start
3. Verify ngrok tunnel is online
4. Connect your ESP32 devices
5. Monitor GPS data in real-time!

🎉 **Happy Tracking!**
