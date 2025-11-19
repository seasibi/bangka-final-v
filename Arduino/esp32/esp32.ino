#include <Arduino.h>

// PPPoS over SIM808 + HTTP POST to Django ingest
// Libraries required: PPPOSClient (installed) and ArduinoHttpClient
#include <PPPOS.h>
#include <PPPOSClient.h>
#include <ArduinoHttpClient.h>
#include <driver/uart.h>  // for runtime baud switching and escape timing
#include <esp_timer.h>    // for reliable non-blocking beeper auto-off

// I2C 16x2 LCD (HD44780 + PCF8574 backpack)
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <ArduinoJson.h>  // For parsing boundary JSON from backend

// ====== TYPE DEFINITIONS ======
// Geofence point structure (must be defined before use)
struct GeoPoint {
  double lat;
  double lon;
};

// ====== CONFIGURE THESE ======
static const int MODEM_RX_PIN = 16;   // SIM808 TX -> ESP32 RX
static const int MODEM_TX_PIN = 17;   // SIM808 RX -> ESP32 TX
static const uint32_t MODEM_BAUD = 9600;
static const int MODEM_UART_NUM = 2;  // use UART2

// I2C pins for LCD (do not use 16/17 which are modem pins)
static const int I2C_SDA = 21;
static const int I2C_SCL = 22;

static const char* APN          = "http.globe.com.ph";  // Globe PH (APN will be set via AT)
// Define HTTP endpoint parts for ArduinoHttpClient
static const char* SERVER_HOST   = "unskilfully-unsoftening-flynn.ngrok-free.dev"; // hostname (no scheme)
static const int   SERVER_PORT   = 80;                   // HTTP port (ngrok accepts http)
static const char* SERVER_PATH   = "/api/ingest/v1/positions/"; // path (trailing slash prevents 307 redirect)
static const char* DEVICE_TOKEN  = "022cf431b6b30937ff845eb898b63fe97abb7e5ba9d67171ac43c2a17e5be7d4";

// Default provisioning values (used when provisioning via Web Serial)
static const char* DEFAULT_SERVER_HOST = "unskilfully-unsoftening-flynn.ngrok-free.dev";
static const int   DEFAULT_SERVER_PORT = 80;
static const char* DEFAULT_SERVER_PATH = "/api/ingest/v1/positions/"; 

// Last known GPS position (stored when valid fix is acquired)
static float g_last_known_lat = 0.0f;
static float g_last_known_lng = 0.0f;
static bool  g_has_last_known_position = false;

// Send interval (ms) - optimized for real-time tracking
static const uint32_t SEND_INTERVAL_MS = 8000;   // 8 seconds (safer for PPP redial)
static const uint32_t SEND_JITTER_MS   = 1500;   // +/- jitter to avoid sync bursts
// Timeout for PPP connect (ms)
static const uint32_t PPP_CONNECT_TIMEOUT_MS = 30000;
// Escape-to-AT frequency to read GNSS (reduces frequent PPP flips). 1 = every loop, 2 = every 2 loops, etc.
static const uint8_t  GPS_ESCAPE_EVERY_N_DEFAULT = 2;

// GPS acquisition helpers
static const bool     FLIGHT_MODE_DURING_GPS = false;  // Keep cellular RF on to avoid CFUN toggles each cycle (faster updates)
static const uint32_t INITIAL_GPS_LOCK_MS     = 180000; // 3 minutes initial window for first fix (cold start)
static const uint32_t GPS_POLL_INTERVAL_MS    = 1000;   // Poll +CGNSINF every 1s during search
static const bool     ENABLE_GNSS_URC         = false;  // URCs off by default; enable if firmware supports
// Configuration storage namespace
static const char* TRACKER_PREF_NAMESPACE = "bangka_tracker";

// BEEPER Configuration
static const int BEEP_PIN = 25;              // GPIO for passive buzzer
static const uint32_t BEEP_ON_MS = 400;      // legacy pattern ON duration
static const uint32_t BEEP_OFF_MS = 400;     // legacy pattern OFF duration
static const uint8_t  BEEP_CYCLES = 7;       // legacy pattern cycles
static const uint32_t BEEP_TOTAL_MS = 5600;  // robust one-shot total alarm duration (~5.6s)
static const uint32_t BEEP_COOLDOWN_MS = 60000; // 60 seconds cooldown between beeps
static const uint32_t VIOLATION_TIMEOUT_SECONDS = 15UL * 60UL;  // 15-minute dwell outside geofence
static const float    IDLE_DISTANCE_THRESHOLD_METERS = 50.0f;   // movement threshold for "idle" detection
// =============================

// PPP socket client
static PPPOSClient pppClient;

// Non-blocking beeper state
static bool     g_beep_active = false;
static bool     g_beep_level  = false;
static uint8_t  g_beep_cycles_left = 0;
static uint32_t g_beep_next_ms = 0;
static uint32_t g_beep_on_dur_ms = 150;
static uint32_t g_beep_off_dur_ms = 150;
static uint32_t g_last_beep_time = 0;         // Track last beep time for cooldown
static bool     g_force_beep_request = false;  // For testing
static esp_timer_handle_t g_beep_off_timer = nullptr; // one-shot auto-off timer

// Network health tracking (used to adapt behavior and minimize reconnections)
static uint32_t g_last_http_success_ms = 0;
static uint16_t g_http_consecutive_failures = 0;
static uint8_t  g_escape_every_n = GPS_ESCAPE_EVERY_N_DEFAULT;
static uint8_t  g_loop_counter = 0;

// Ensure PPPOS UART is initialized before any AT commands
static bool g_pppos_inited = false;
static void pppos_ensure_uart() {
  if (!g_pppos_inited) {
    PPPOS_init(MODEM_TX_PIN, MODEM_RX_PIN, MODEM_BAUD, MODEM_UART_NUM, (char*)"", (char*)"");
    g_pppos_inited = true;
    delay(200);
  }
}

// Beeper functions (PASSIVE BUZZER - uses PWM tone)
static void beep_stop() {
  noTone(BEEP_PIN);
  g_beep_active = false;
  g_beep_level = false;
  g_beep_cycles_left = 0;
  Serial.println("[BEEP] Alert ended (auto-off)");
}

static void IRAM_ATTR beep_off_timer_cb(void* arg) {
  beep_stop();
}

static void beeper_init() {
  pinMode(BEEP_PIN, OUTPUT);
  noTone(BEEP_PIN); // idle OFF for passive buzzer
  if (g_beep_off_timer == nullptr) {
    esp_timer_create_args_t args = {};
    args.callback = &beep_off_timer_cb;
    args.arg = nullptr;
    args.dispatch_method = ESP_TIMER_TASK;
    args.name = "beep_off";
    if (esp_timer_create(&args, &g_beep_off_timer) != ESP_OK) {
      Serial.println("[BEEP] Failed to create auto-off timer");
    }
  }
  Serial.println("[BEEP] Passive buzzer initialized on GPIO " + String(BEEP_PIN) + " (PWM tone mode)");
}

static void beep_start(uint8_t cycles, uint32_t on_ms, uint32_t off_ms) {
  // Check cooldown - don't beep if we beeped recently
  uint32_t now = millis();
  if (g_last_beep_time > 0 && (now - g_last_beep_time) < BEEP_COOLDOWN_MS) {
    uint32_t remaining = (BEEP_COOLDOWN_MS - (now - g_last_beep_time)) / 1000;
    Serial.printf("[BEEP] Cooldown active - %lu seconds remaining\n", remaining);
    return;
  }
  // Cancel any pending auto-off
  if (g_beep_off_timer) {
    esp_timer_stop(g_beep_off_timer);
  }
  // Start a continuous tone and rely on hardware timer to stop after BEEP_TOTAL_MS
  tone(BEEP_PIN, 2000); // steady 2kHz tone
  g_beep_active = true;
  g_beep_level = true;
  g_beep_cycles_left = 0; // disable legacy pattern toggling
  g_beep_on_dur_ms = on_ms;
  g_beep_off_dur_ms = off_ms;
  g_beep_next_ms = now;
  g_last_beep_time = now; // Record this beep time
  Serial.println("[BEEP] Alert started (auto-off scheduled)");
  if (g_beep_off_timer) {
    esp_timer_start_once(g_beep_off_timer, (uint64_t)BEEP_TOTAL_MS * 1000ULL); // microseconds
  }
}

static void beep_update() {
  // Legacy pattern toggling disabled when using auto-off timer
  if (!g_beep_active || g_beep_cycles_left == 0) return;
  uint32_t now = millis();
  if (now < g_beep_next_ms) return;
  g_beep_level = !g_beep_level;
  if (g_beep_level) {
    tone(BEEP_PIN, 2000);
  } else {
    noTone(BEEP_PIN);
  }
  g_beep_cycles_left--;
  if (g_beep_cycles_left == 0) {
    beep_stop();
    return;
  }
  g_beep_next_ms = now + (g_beep_level ? g_beep_on_dur_ms : g_beep_off_dur_ms);
}

static void beep_quick(uint8_t chirps = 3, uint16_t on_ms = 150, uint16_t off_ms = 150) {
  // PASSIVE BUZZER: use tone() for audible beeps
  for (uint8_t i = 0; i < chirps; ++i) {
    tone(BEEP_PIN, 2000);  // 2kHz tone ON
    delay(on_ms);
    noTone(BEEP_PIN); // Tone OFF
    delay(off_ms);
  }
}

// LCD globals
static LiquidCrystal_I2C* lcd = nullptr;
static bool lcdReady = false;
static bool g_ppp_connected = false;
static int  g_last_http_code = 0;

// Forward declarations for LCD helpers (avoid Arduino prototype quirks)
static void lcd_show(const char* line1, const char* line2);
static void lcd_status(const char* httpLine);
static void lcd_spinner(const char* line1Base, const char* line2);

// Secure provisioning with enhanced storage and verification
static Preferences prefs;
static Preferences geoPrefs;  // NVS namespace for geofence/idle state

// Persistent geofence + idle state
static bool     g_outside_state       = false;  // true if currently outside polygon
static uint32_t g_boundary_exit_time  = 0;      // Unix time when idle-outside period started
static bool     g_violation_triggered = false;  // avoid repeated local alerts
static uint32_t g_last_gps_unix       = 0;      // last known GPS Unix time (seconds)
static uint32_t g_violation_timestamp = 0;      // Unix time when last violation was triggered

static float    g_idle_base_lat       = 0.0f;   // reference point for idle-distance measurement
static float    g_idle_base_lng       = 0.0f;
static bool     g_has_idle_base       = false;

// Dynamic geofence boundary (loaded from backend during provisioning)
static GeoPoint* g_geofence_polygon = nullptr;  // Dynamic array allocated from NVS
static size_t    g_geofence_vertices = 0;       // Number of vertices in polygon
static const size_t MAX_GEOFENCE_VERTICES = 50; // Maximum vertices supported

struct TrackerConfig {
  String device_id;  // unique device identifier 
  String host;       // e.g. ngrok hostname
  int    port;       // e.g. 80
  String path;       // e.g. /api/ingest/v1/positions/
  String token;      // device token
  bool   provisioned; // successful provisioning flag
  uint32_t crc;      // configuration checksum for integrity verification
};

static TrackerConfig g_cfg;
static bool g_provisioned = false;
static bool g_provisioning_in_progress = false;
static bool g_credentials_changed = false;

// Calculate CRC32 for config verification
static uint32_t calc_config_crc() {
  // Simple CRC32 implementation for strings
  const uint32_t polynomial = 0xEDB88320;
  uint32_t crc = 0xFFFFFFFF;
  
  // Process device_id
  for (size_t i = 0; i < g_cfg.device_id.length(); i++) {
    uint8_t byte = g_cfg.device_id[i];
    crc ^= byte;
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
    }
  }
  
  // Process host
  for (size_t i = 0; i < g_cfg.host.length(); i++) {
    uint8_t byte = g_cfg.host[i];
    crc ^= byte;
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
    }
  }
  
  // Process token
  for (size_t i = 0; i < g_cfg.token.length(); i++) {
    uint8_t byte = g_cfg.token[i];
    crc ^= byte;
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
    }
  }
  
  // Include path and port in CRC
  String portStr = String(g_cfg.port);
  for (size_t i = 0; i < portStr.length(); i++) {
    uint8_t byte = portStr[i];
    crc ^= byte;
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
    }
  }
  
  for (size_t i = 0; i < g_cfg.path.length(); i++) {
    uint8_t byte = g_cfg.path[i];
    crc ^= byte;
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? polynomial : 0);
    }
  }
  
  return crc ^ 0xFFFFFFFF;
}

static bool cfg_load() {
  prefs.begin(TRACKER_PREF_NAMESPACE, true);
  g_cfg.device_id = prefs.getString("device_id", "");
  g_cfg.host = prefs.getString("host", "");
  g_cfg.port = prefs.getInt("port", 0);
  g_cfg.path = prefs.getString("path", "");
  g_cfg.token = prefs.getString("token", "");
  g_cfg.provisioned = prefs.getBool("provisioned", false);
  g_cfg.crc = prefs.getUInt("crc", 0);
  prefs.end();
  
  // Check if we have valid configuration and verify integrity
  g_provisioned = g_cfg.provisioned && g_cfg.token.length() > 0;
  
  if (g_provisioned) {
    // Verify configuration integrity with CRC
    uint32_t computed_crc = calc_config_crc();
    if (computed_crc != g_cfg.crc) {
      Serial.println("[CFG] WARNING: Configuration CRC mismatch! Possible tampering or corruption.");
      g_provisioned = false;
    }
  }
  
  Serial.printf("[CFG] device_id=%s host=%s port=%d path=%s token:%s provisioned=%s\n",
                g_cfg.device_id.c_str(), g_cfg.host.c_str(), g_cfg.port, g_cfg.path.c_str(),
                g_cfg.token.length() ? "set" : "empty", g_provisioned ? "yes" : "no");
  
  return g_provisioned;
}

static bool cfg_save() {
  if (!g_credentials_changed) {
    return true; // No changes to save
  }
  
  // Calculate new CRC before saving
  g_cfg.crc = calc_config_crc();
  
  Serial.println("[CFG] Opening Preferences for write...");
  if (!prefs.begin(TRACKER_PREF_NAMESPACE, false)) {
    Serial.println("[CFG] ERROR: Failed to open Preferences namespace!");
    return false;
  }
  
  // Check available NVS space
  Serial.printf("[CFG] NVS free entries: %d\n", prefs.freeEntries());
  
  bool success = true;
  size_t written;
  
  // Save each field with individual error checking
  Serial.printf("[CFG] Saving device_id (%d bytes)...\n", g_cfg.device_id.length());
  written = prefs.putString("device_id", g_cfg.device_id);
  if (written == 0 && g_cfg.device_id.length() > 0) {
    Serial.println("[CFG] ERROR: Failed to write device_id!");
    success = false;
  }
  
  Serial.printf("[CFG] Saving host (%d bytes)...\n", g_cfg.host.length());
  written = prefs.putString("host", g_cfg.host);
  if (written == 0 && g_cfg.host.length() > 0) {
    Serial.println("[CFG] ERROR: Failed to write host!");
    success = false;
  }
  
  Serial.println("[CFG] Saving port...");
  written = prefs.putInt("port", g_cfg.port);
  if (written == 0) {
    Serial.println("[CFG] ERROR: Failed to write port!");
    success = false;
  }
  
  Serial.printf("[CFG] Saving path (%d bytes)...\n", g_cfg.path.length());
  written = prefs.putString("path", g_cfg.path);
  if (written == 0 && g_cfg.path.length() > 0) {
    Serial.println("[CFG] ERROR: Failed to write path!");
    success = false;
  }
  
  Serial.printf("[CFG] Saving token (%d bytes)...\n", g_cfg.token.length());
  written = prefs.putString("token", g_cfg.token);
  if (written == 0 && g_cfg.token.length() > 0) {
    Serial.println("[CFG] ERROR: Failed to write token!");
    success = false;
  }
  
  Serial.println("[CFG] Saving provisioned flag...");
  written = prefs.putBool("provisioned", g_cfg.provisioned);
  if (written == 0) {
    Serial.println("[CFG] ERROR: Failed to write provisioned!");
    success = false;
  }
  
  Serial.printf("[CFG] Saving CRC (%u)...\n", g_cfg.crc);
  written = prefs.putUInt("crc", g_cfg.crc);
  if (written == 0) {
    Serial.println("[CFG] ERROR: Failed to write CRC!");
    success = false;
  }
  
  prefs.end();
  g_credentials_changed = false;
  
  if (success) {
    Serial.println("[CFG] Configuration saved successfully.");
    return true;
  } else {
    Serial.println("[CFG] ERROR: One or more fields failed to save!");
    Serial.println("[CFG] Try erasing NVS with RESET command and reprovisioning.");
    return false;
  }
}

static bool cfg_set_kv(const String &key, const String &val) {
  String K = key; K.trim(); K.toUpperCase();
  String V = val; V.trim();
  bool changed = false;
  
  if (K == "DEVICE" || K == "DEVICE_ID") {
    if (V != g_cfg.device_id) {
      g_cfg.device_id = V;
      changed = true;
      Serial.printf("[PROV] Device ID set: %s\n", V.c_str());
    }
  } else if (K == "HOST") {
    if (g_cfg.host != val) {
      g_cfg.host = val;
      changed = true;
      Serial.println("[PROV] OK HOST");
    }
  } else if (K == "PORT") {
    int port_val = val.toInt();
    if (g_cfg.port != port_val) {
      g_cfg.port = port_val;
      changed = true;
      Serial.println("[PROV] OK PORT");
    }
  } else if (K == "PATH") {
    if (g_cfg.path != val) {
      g_cfg.path = val;
      changed = true;
      Serial.println("[PROV] OK PATH");
    }
  } else if (K == "TOKEN") {
    if (g_cfg.token != val) {
      g_cfg.token = val;
      changed = true;
      Serial.println("[PROV] OK TOKEN");
    }
  } else if (K == "STORE_CREDENTIALS" || K == "PROVISION") {
    // Special command to finalize and persist configuration (PROVISION for simplicity)
    
    // Auto-complete missing fields with defaults before validation
    if (g_cfg.host.length() == 0) {
      g_cfg.host = DEFAULT_SERVER_HOST;
      Serial.printf("[PROV] Using default host: %s\n", DEFAULT_SERVER_HOST);
    }
    if (g_cfg.port == 0) {
      g_cfg.port = DEFAULT_SERVER_PORT;
      Serial.printf("[PROV] Using default port: %d\n", DEFAULT_SERVER_PORT);
    }
    if (g_cfg.path.length() == 0) {
      g_cfg.path = DEFAULT_SERVER_PATH;
      Serial.printf("[PROV] Using default path: %s\n", DEFAULT_SERVER_PATH);
    }
    
    // Now verify we have essential fields (only device_id and token required)
    if (g_cfg.device_id.length() > 0 && g_cfg.token.length() > 0) {
      g_cfg.provisioned = true;
      g_credentials_changed = true;
      
      if (cfg_save()) {
        Serial.println("[PROV] ✅ Credentials stored successfully!");
        g_provisioning_in_progress = false;
        g_provisioned = true;
        
        // Note: Boundary fetch will happen automatically after modem is initialized
        Serial.println("[PROV] ✅ Provisioning complete!");
        Serial.println("[PROV] Boundary will be fetched after modem initializes...");
        Serial.println("[PROV] OR send 'FETCH_BOUNDARY' command manually after device boots");
        lcd_show("Provisioned!", "Reboot to fetch");
        
        delay(2000);
        return true;
      } else {
        Serial.println("[PROV] ERROR: Failed to store credentials!");
        return false;
      }
    } else {
      Serial.println("[PROV] ERROR: Missing required fields. Need DEVICE_ID and TOKEN.");
      Serial.printf("[PROV] Current: device_id=%s, token=%s\n", 
                   g_cfg.device_id.c_str(), 
                   g_cfg.token.length() > 0 ? "(set)" : "(empty)");
      return false;
    }
  } else if (K == "VERIFY") {
    // Verify configuration integrity
    if (g_provisioned) {
      uint32_t computed_crc = calc_config_crc();
      if (computed_crc == g_cfg.crc) {
        Serial.println("[PROV] CHECKSUM OK");
        return true;
      } else {
        Serial.printf("[PROV] CHECKSUM FAILED: stored=%u computed=%u\n", g_cfg.crc, computed_crc);
        return false;
      }
    } else {
      Serial.println("[PROV] ERROR: Not provisioned, cannot verify");
      return false;
    }
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
  } else if (K == "ERASE" || K == "RESET") {
    prefs.begin(TRACKER_PREF_NAMESPACE, false);
    prefs.clear(); 
    prefs.end();
    
    // Clear geofence polygon from memory and NVS
    if (g_geofence_polygon) {
      free(g_geofence_polygon);
      g_geofence_polygon = nullptr;
    }
    g_geofence_vertices = 0;
    geoPrefs.clear();  // Clear all geofence data (polygon, state, etc.)
    
    g_cfg.device_id = ""; g_cfg.host = ""; g_cfg.port = 0; g_cfg.path = ""; g_cfg.token = "";
    g_cfg.provisioned = false;
    g_cfg.crc = 0;
    g_provisioned = false;
    g_credentials_changed = false;
    g_provisioning_in_progress = false;
    Serial.println("[PROV] Configuration and geofence erased. Send DEVICE_ID and TOKEN to provision.");
    if (lcdReady) lcd_show("Provision", "Needed");
    return true;
  } else {
    Serial.println("[PROV] Unknown key");
    return false;
  }
  
  if (changed) {
    g_credentials_changed = true;
    g_provisioning_in_progress = true;
    
    // Check if we have minimum required fields for auto-provisioning
    if (g_cfg.device_id.length() > 0 && g_cfg.token.length() > 0) {
      Serial.println("[PROV] Essential fields set. Send 'PROVISION' to complete, or add more fields first.");
    }
  }
  
  return changed;
}

static void cfg_print() {
  Serial.printf("[INFO] DEVICE_ID=%s\n", g_cfg.device_id.c_str());
  Serial.printf("[INFO] HOST=%s\n", g_cfg.host.c_str());
  Serial.printf("[INFO] PORT=%d\n", g_cfg.port);
  Serial.printf("[INFO] PATH=%s\n", g_cfg.path.c_str());
  Serial.printf("[INFO] TOKEN=%s\n", g_cfg.token.c_str());
  Serial.printf("[INFO] PROVISIONED=%s\n", g_provisioned ? "yes" : "no");
  Serial.printf("[INFO] CRC=%u\n", g_cfg.crc);
}
static void lcd_show(const char* line1, const char* line2) {
  if (!lcdReady || !lcd) return;
  lcd->clear();
  lcd->setCursor(0,0);
  lcd->print(line1);
  lcd->setCursor(0,1);
  lcd->print(line2);
}

static void lcd_status(const char* httpLine) {
  char l1[17];
  snprintf(l1, sizeof(l1), "PPP:%s", g_ppp_connected ? "Conn" : "Disc");
  lcd_show(l1, httpLine);
}

// Spinner status helper: shows a rotating character at the end of line1
static void lcd_spinner(const char* line1Base, const char* line2) {
  if (!lcdReady || !lcd) return;
  static const char frames[] = "|/-\\";
  static uint8_t idx = 0;
  char l1[17];
  snprintf(l1, sizeof(l1), "%.15s%c", line1Base, frames[idx++ & 3]);
  lcd_show(l1, line2);
}

// Parse +CSQ to dBm; returns true if parsed
static bool parse_csq_dbm(const String &resp, int &dbmOut) {
  int p = resp.indexOf("+CSQ:");
  if (p < 0) return false;
  int comma = resp.indexOf(',', p);
  if (comma < 0) return false;
  String rssiStr = resp.substring(p + 5, comma);
  rssiStr.trim();
  int rssi = rssiStr.toInt();
  if (rssi == 99) return false; // unknown
  if (rssi < 0) rssi = 0;
  if (rssi > 31) rssi = 31;
  dbmOut = -113 + 2 * rssi; // 0->-113dBm, 31->-51dBm
  return true;
}

static void lcd_setup() {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000); // 100kHz for longer wires
  Serial.printf("[LCD] I2C begin SDA=%d SCL=%d\n", I2C_SDA, I2C_SCL);

  // Try common addresses first for speed
  uint8_t candidates[] = { 0x27, 0x3F };
  uint8_t found = 0;
  for (uint8_t i = 0; i < sizeof(candidates); ++i) {
    Wire.beginTransmission(candidates[i]);
    if (Wire.endTransmission() == 0) { found = candidates[i]; break; }
  }
  if (!found) {
    // Fallback: scan entire bus
    for (uint8_t addr = 1; addr < 127; ++addr) {
      Wire.beginTransmission(addr);
      if (Wire.endTransmission() == 0) { found = addr; break; }
    }
  }

  if (found) {
    Serial.printf("[LCD] Found device at 0x%02X\n", found);
    lcd = new LiquidCrystal_I2C(found, 16, 2);
    // Some libs need init(), others need begin(16,2). Call both safely.
    lcd->init();
    #if defined(LiquidCrystal_I2C_h)
    // keep default
    #endif
    lcd->backlight();
    // Some variants expose begin(16,2)
    // (call guardedly; if not present the library will ignore at link-time)
    // lcd->begin(16, 2);
    lcdReady = true;
    lcd_show("Bangka GPS", "Booting...");
  } else {
    Serial.println("[LCD] No I2C device found. Running without LCD.");
    // No I2C device found; continue without LCD
    lcdReady = false;
  }
}

// --- Small helpers to use the raw UART via PPPOS_* during AT phase ---
static String ppp_read_for(uint32_t timeout_ms) {
  String out;
  uint32_t start = millis();
  while (millis() - start < timeout_ms) {
    char* chunk = PPPOS_read();
    if (chunk) out += chunk;
    delay(10);
  }
  return out;
}

static bool ppp_send_and_wait(const char* cmd_no_cr, const char* expect, uint32_t timeout_ms) {
  // Build "cmd\r\n" (some firmwares need CRLF)
  char buf[160];
  size_t n = strlcpy(buf, cmd_no_cr, sizeof(buf));
  if (n < sizeof(buf) - 3) { buf[n++] = '\r'; buf[n++] = '\n'; buf[n] = 0; }
  Serial.print(">> "); Serial.println(cmd_no_cr);
  PPPOS_write(buf);
  String resp = ppp_read_for(timeout_ms);
  if (expect && *expect) {
    bool ok = resp.indexOf(expect) >= 0;
    if (!ok) {
      Serial.print("!! Expect not found: "); Serial.println(expect);
      Serial.print("   Resp: "); Serial.println(resp);
    }
    return ok;
  }
  return true;
}

static String ppp_send_and_read(const char* cmd_no_cr, uint32_t timeout_ms) {
  char buf[160];
  size_t n = strlcpy(buf, cmd_no_cr, sizeof(buf));
  if (n < sizeof(buf) - 3) { buf[n++] = '\r'; buf[n++] = '\n'; buf[n] = 0; }
  Serial.print(">> "); Serial.println(cmd_no_cr);
  PPPOS_write(buf);
  return ppp_read_for(timeout_ms);
}

static void ensure_command_mode() {
  pppos_ensure_uart();
  delay(1200);
  PPPOS_write((char*)"+++");
  delay(1200);
}

// Return to data mode without tearing down PPP (preferred for fast cycles)
static bool resume_data_mode() {
  pppos_ensure_uart();
  // Try standard resume first
  if (ppp_send_and_wait("ATO", "CONNECT", 7000)) return true;
  // Some firmwares use ATO0
  if (ppp_send_and_wait("ATO0", "CONNECT", 7000)) return true;
  return false;
}

static bool parse_latlng_generic(const String &resp, float &lat, float &lng) {
  // Extract floats and pick first pair within valid ranges
  const char* s = resp.c_str();
  float vals[16];
  int count = 0;
  char* endp = nullptr;
  while (*s && count < 16) {
    float v = strtof(s, &endp);
    if (endp != s) {
      vals[count++] = v;
      s = endp;
    } else {
      s++;
    }
  }
  for (int i = 0; i + 1 < count; ++i) {
    float a = vals[i];
    float b = vals[i+1];
    if (a >= -90.0f && a <= 90.0f && b >= -180.0f && b <= 180.0f) {
      if (a != 0.0f || b != 0.0f) { lat = a; lng = b; return true; }
    }
  }
  return false;
}

static bool gps_power_on() {
  // Try GNSS power on commands
  bool ok = ppp_send_and_wait("AT+CGNSPWR=1", "OK", 2000);
  if (!ok) ok = ppp_send_and_wait("AT+CGPSPWR=1", "OK", 2000);
  return ok;
}

// Parse a single +CGNSINF line to extract run status, fix status, and coordinates
static bool parse_cgnsinf(const String &resp, int &run, int &fix, float &lat, float &lng) {
  int idx = resp.indexOf("+CGNSINF:");
  if (idx < 0) idx = resp.indexOf("+UGNSINF:"); // some firmwares use +UGNSINF
  if (idx < 0) return false;
  int end = resp.indexOf('\n', idx);
  String line = (end > idx) ? resp.substring(idx, end) : resp.substring(idx);
  int colon = line.indexOf(':');
  String data = (colon >= 0) ? line.substring(colon + 1) : line;
  // Tokenize by comma
  run = 0; fix = 0; lat = 0; lng = 0;
  int token = 0;
  int start = 0;
  for (int i = 0; i <= data.length(); ++i) {
    if (i == data.length() || data[i] == ',') {
      String t = data.substring(start, i);
      t.trim();
      if (token == 0) run = t.toInt();
      else if (token == 1) fix = t.toInt();
      else if (token == 3) lat = t.toFloat();
      else if (token == 4) lng = t.toFloat();
      token++;
      start = i + 1;
    }
  }
  return true;
}

// Extended parser to also capture HDOP and satellites used (token 10 and 15 in most SIMCom formats)
static bool parse_cgnsinf_ex(const String &resp, int &run, int &fix, float &lat, float &lng, float &hdop, int &satsUsed) {
  int idx = resp.indexOf("+CGNSINF:");
  if (idx < 0) idx = resp.indexOf("+UGNSINF:"); // supports +UGNSINF variants
  if (idx < 0) return false;
  int end = resp.indexOf('\n', idx);
  String line = (end > idx) ? resp.substring(idx, end) : resp.substring(idx);
  int colon = line.indexOf(':');
  String data = (colon >= 0) ? line.substring(colon + 1) : line;
  run = 0; fix = 0; lat = 0; lng = 0; hdop = 0; satsUsed = 0;
  int token = 0;
  int start = 0;
  for (int i = 0; i <= data.length(); ++i) {
    if (i == data.length() || data[i] == ',') {
      String t = data.substring(start, i);
      t.trim();
      if (token == 0) run = t.toInt();
      else if (token == 1) fix = t.toInt();
      else if (token == 3) lat = t.toFloat();
      else if (token == 4) lng = t.toFloat();
      else if (token == 10) hdop = t.toFloat();
      else if (token == 15) satsUsed = t.toInt();
      token++;
      start = i + 1;
    }
  }
  return true;
}

static bool gps_get_coords(float &outLat, float &outLng) {
  pppos_ensure_uart();
  ensure_command_mode();
  gps_power_on();
  // Try CGNSINF first so we can also inspect fix status
  String r = ppp_send_and_read("AT+CGNSINF", 5000);
  float lat, lng;
  int run = 0, fix = 0;
  if (r.indexOf("+CGNSINF") >= 0) {
    if (parse_cgnsinf(r, run, fix, lat, lng)) {
      if (fix == 1 && (lat != 0.0f || lng != 0.0f)) { outLat = lat; outLng = lng; return true; }
    }
  }
  // Fallback older SIM808 commands
  r = ppp_send_and_read("AT+CGPSINF=0", 5000); // sometimes returns different format
  if (r.indexOf("+CGPSINF") >= 0 && parse_latlng_generic(r, lat, lng)) {
    outLat = lat; outLng = lng; return true;
  }
  r = ppp_send_and_read("AT+CGPSINFO", 5000);
  if (r.indexOf("+CGPSINFO") >= 0 && parse_latlng_generic(r, lat, lng)) {
    outLat = lat; outLng = lng; return true;
  }
  return false;
}

// Enable/disable cellular RF using CFUN; keeps GNSS running
static void cell_set_flight_mode(bool on) {
  pppos_ensure_uart();
  ensure_command_mode();
  if (on) {
    lcd_show("Cell RF", "Off (CFUN=0)");
    ppp_send_and_wait("AT+CFUN=0", "OK", 5000);
  } else {
    lcd_show("Cell RF", "On (CFUN=1)");
    ppp_send_and_wait("AT+CFUN=1", "OK", 8000);
  }
}

// --- Extra GNSS diagnostics helpers ---
static void gnss_diagnostics() {
  // Query module for high-level GPS status and legacy info for visibility
  pppos_ensure_uart();
  ensure_command_mode();
  gps_power_on();
  String st = ppp_send_and_read("AT+CGPSSTATUS?", 5000);
  Serial.print("[GNSS] STATUS? "); Serial.println(st);
  String inf0 = ppp_send_and_read("AT+CGPSINF=0", 5000);
  Serial.print("[GNSS] CGPSINF=0 "); Serial.println(inf0);
}

static void gnss_cold_reset_once() {
  static bool done = false;
  if (done) return;
  done = true;
  pppos_ensure_uart();
  ensure_command_mode();
  gps_power_on();
  Serial.println("[GNSS] Cold reset request");
  // Some firmwares support CGPSRST; ignore result if unsupported
  ppp_send_and_read("AT+CGPSRST=3", 3000);
  // Ensure GNSS is powered back on after reset
  gps_power_on();
}

// Optional initial GPS lock window at boot to speed up first fix
static bool initial_gps_lock_window(uint32_t window_ms) {
  if (window_ms == 0) return false;
  pppos_ensure_uart();
  ensure_command_mode();
  if (FLIGHT_MODE_DURING_GPS) cell_set_flight_mode(true);
  gps_power_on();
  if (ENABLE_GNSS_URC) {
    // Best-effort: not all firmwares support URCs
    ppp_send_and_wait("AT+CGNSURC=1", "OK", 1000);
  }
  uint32_t start = millis();
  bool got = false;
  uint32_t lastDiag = 0;
  while (millis() - start < window_ms) {
    String r = ppp_send_and_read("AT+CGNSINF", 5000);
    Serial.print("[GNSS] "); Serial.println(r);
    int run = 0, fix = 0; float lat = 0, lng = 0; float hdop = 0; int used = 0;
    bool ok = parse_cgnsinf_ex(r, run, fix, lat, lng, hdop, used);
    uint32_t left = (window_ms - (millis() - start)) / 1000UL;
    if (ok && run == 1 && fix == 1 && (lat != 0.0f || lng != 0.0f)) {
      char l2[17]; snprintf(l2, sizeof(l2), "u:%d hd:%.1f", used, hdop);
      lcd_show("GPS: FIX", l2);
      got = true;
      break;
    } else {
      char l2[17]; snprintf(l2, sizeof(l2), "u:%d hd:%.1f", used, hdop);
      lcd_spinner("GPS Search", l2);
      // Run extra diagnostics every ~7s to avoid blocking too much
      if (millis() - lastDiag > 7000) { gnss_diagnostics(); lastDiag = millis(); }
    }
    delay(GPS_POLL_INTERVAL_MS);
  }
  if (FLIGHT_MODE_DURING_GPS) cell_set_flight_mode(false);
  return got;
}

// Dial the packet data call and enter data mode (CONNECT)
static bool modem_dial() {
  // Initialize PPPOS on UART (only once)
  pppos_ensure_uart();

  // Try to ensure we're in command mode: guard time + '+++' + guard time
  delay(1200);
  PPPOS_write((char*)"+++");
  delay(1200);
  lcd_spinner("Modem:CmdMode", "Probing...");

  // Try multiple baud rates for autobaud modules
  uint32_t bauds[] = {9600, 115200, 19200};
  bool at_ok = false;
  for (uint8_t b = 0; b < sizeof(bauds)/sizeof(bauds[0]); b++) {
    uart_set_baudrate((uart_port_t)MODEM_UART_NUM, bauds[b]);
    for (int i = 0; i < 8; i++) {
      char l2[17];
      snprintf(l2, sizeof(l2), "@%lu try %d", (unsigned long)bauds[b], i + 1);
      lcd_spinner("Modem AT", l2);
      if (ppp_send_and_wait("AT", "OK", 1500)) { at_ok = true; break; }
      delay(300);
    }
    if (at_ok) break;
  }
  if (!at_ok) {
    lcd_show("Modem AT", "Failed");
    return false;
  }
  lcd_show("Modem AT", "OK");

  ppp_send_and_wait("ATE0", "OK", 1000); // echo off (optional)
  ppp_send_and_wait("AT+CMEE=2", "OK", 1000); // verbose errors
  // Some firmwares don't support IFC; probe only; ignore error
  (void)ppp_send_and_read("AT+IFC?", 1000);

  bool sim_ready = ppp_send_and_wait("AT+CPIN?", "READY", 2000); // SIM ready
  lcd_show("SIM Status", sim_ready ? "READY" : "NOT READY");

  String csq = ppp_send_and_read("AT+CSQ", 1000);   // signal debug
  int dbm = 0;
  if (parse_csq_dbm(csq, dbm)) {
    char l2[17]; snprintf(l2, sizeof(l2), "CSQ:%ddBm", dbm);
    lcd_show("Signal", l2);
  } else {
    lcd_show("Signal", "Unknown");
  }
  ppp_send_and_wait("AT+CREG?", "+CREG:", 1000); // network reg status

  // Lock baud at 9600 to avoid autobaud surprises
  if (ppp_send_and_wait("AT+IPR=9600", "OK", 1500)) {
    uart_set_baudrate((uart_port_t)MODEM_UART_NUM, 9600);
  }

  // Proactively detach/deactivate PDP before setting APN (helps with CME ERROR on some SIM808 firmwares)
  (void)ppp_send_and_read("AT+CGACT=0,1", 3000);
  (void)ppp_send_and_read("AT+CGATT=0", 4000);
  delay(500);

  // Set PDP context APN (try multiple variations if needed)
  {
    const char* apns[] = { APN, "internet.globe.com.ph", "internet" };
    bool apn_set = false;
    for (uint8_t i = 0; i < sizeof(apns)/sizeof(apns[0]); i++) {
      char cmd[128];
      snprintf(cmd, sizeof(cmd), "AT+CGDCONT=1,\"IP\",\"%s\"", apns[i]);
      char l2[17]; snprintf(l2, sizeof(l2), "APN:%-.12s", apns[i]);
      lcd_spinner("Setting APN", l2);
      if (ppp_send_and_wait(cmd, "OK", 6000)) { apn_set = true; break; }
    }
    if (!apn_set) {
      // Show existing contexts for debugging but do not fail
      (void)ppp_send_and_read("AT+CGDCONT?", 3000);
      lcd_show("APN", "Using existing");
    } else {
      lcd_show("APN", "Set OK");
    }
  }

  // Re-attach after APN update (ignore failure)
  lcd_spinner("Attaching", "CGATT=1");
  ppp_send_and_wait("AT+CGATT=1", "OK", 8000);

  // Start data call (preferred SIMCom way) then fallback
  lcd_spinner("Dialing PPP", "Connecting...");
  if (!ppp_send_and_wait("AT+CGDATA=\"PPP\",1", "CONNECT", 12000)) {
    if (!ppp_send_and_wait("ATD*99***1#", "CONNECT", 12000)) {
      if (!ppp_send_and_wait("ATD*99#", "CONNECT", 12000)) {
        Serial.println("!! Failed to enter data mode (no CONNECT)");
        lcd_show("PPP Dial", "No CONNECT");
        return false;
      }
    }
  }

  lcd_show("PPP Dial", "CONNECT");
  return true;
}

static bool ppp_connect_blocking(uint32_t timeout_ms) {
  Serial.println("[PPP] Starting...");
  g_ppp_connected = false;
  delay(1200); // settle time after CONNECT before starting PPP negotiation
  PPPOS_start();
  uint32_t start = millis();
  while (millis() - start < timeout_ms) {
    if (PPPOS_isConnected()) {
      Serial.println("[PPP] Connected");
      g_ppp_connected = true;
      lcd_status("Ready");
      return true;
    }
    uint32_t elapsed = millis() - start;
    uint32_t left = (elapsed >= timeout_ms) ? 0 : ((timeout_ms - elapsed) / 1000UL);
    char l2[17]; snprintf(l2, sizeof(l2), "Wait %lus", (unsigned long)left);
    lcd_spinner("PPP Connecting", l2);
    delay(250);
  }
  Serial.println("[PPP] Connect timeout");
  g_ppp_connected = false;
  lcd_status("PPP Timeout");
  return false;
}

static bool http_post_position(float lat, float lng) {
  // First check if device is properly provisioned
  if (!g_provisioned) {
    Serial.println("[HTTP] ERROR: Device not provisioned! Cannot send position.");
    lcd_show("ERROR", "Not provisioned");
    return false;
  }
  
  // Verify config integrity before sending
  uint32_t computed_crc = calc_config_crc();
  if (computed_crc != g_cfg.crc) {
    Serial.println("[HTTP] ERROR: Configuration integrity check failed!");
    lcd_show("ERROR", "Config corrupt");
    return false;
  }
  
  // Build JSON body with device identifier and coordinates
  String body = String("{") +
                "\"lat\":" + String(lat, 6) + "," +
                "\"lng\":" + String(lng, 6) + "," +
                "\"device_id\":" + "\"" + g_cfg.device_id + "\"";
                
  if (g_force_beep_request) {
    body += ",\"force_beep\":true";
  }
  body += "}";

  int status = -999;
  String resp;
  static uint8_t consecutive_failures = 0;

  Serial.print("[HTTP] Body to send: "); Serial.println(body);
  Serial.print("[HTTP] Body length: "); Serial.println(body.length());

  // Exponential backoff: try 3 times with increasing timeout
  for (int attempt = 1; attempt <= 3; ++attempt) {
    // Increase timeout progressively for slow ngrok/cellular
    uint32_t timeout = 12000 + (attempt * 4000); // 16s, 20s, 24s

    // Get required connection parameters from provisioning
    const char* hostUse = g_cfg.host.c_str();
    int         portUse = g_cfg.port;
    const char* pathUse = g_cfg.path.c_str();
    String      tokenUse = g_cfg.token;
    
    // Double-check that we have all required parameters
    if (!hostUse || !portUse || !pathUse || tokenUse.isEmpty()) {
      Serial.println("[HTTP] ERROR: Missing required connection parameters!");
      lcd_show("ERROR", "Bad config");
      return false;
    }

    HttpClient http(pppClient, hostUse, portUse);
    http.setTimeout(timeout);

    Serial.print("[HTTP] Attempt "); Serial.print(attempt);
    Serial.print("/3 (timeout="); Serial.print(timeout); Serial.println("ms)");
    Serial.print("[HTTP] POST http://"); Serial.print(hostUse); Serial.print(":" ); Serial.print(portUse);
    Serial.println(pathUse);

    char statusMsg[17];
    snprintf(statusMsg, sizeof(statusMsg), "Send %d/3", attempt);
    lcd_status(statusMsg);

    Serial.println("[HTTP] Calling beginRequest...");
    http.beginRequest();

    Serial.println("[HTTP] Calling POST...");
    http.post(pathUse);

    Serial.println("[HTTP] Sending headers...");
    http.sendHeader("Content-Type", "application/json");
    http.sendHeader("Authorization", String("Token ") + tokenUse);
    http.sendHeader("X-Device-Token", tokenUse);
    http.sendHeader("X-Device-ID", g_cfg.device_id);
    http.sendHeader("Connection", "close");
    http.sendHeader("Content-Length", body.length());
    
    Serial.println("[HTTP] Sending body...");
    http.beginBody();
    size_t written = http.print(body);
    Serial.print("[HTTP] Body bytes written: "); Serial.println(written);
    
    Serial.println("[HTTP] Calling endRequest...");
    http.endRequest();

    status = http.responseStatusCode();
    resp = http.responseBody();

    // Success: 2xx status codes
    if (status >= 200 && status < 300) {
      consecutive_failures = 0;
      break;
    }
    
    // Handle 3xx redirects (307, 301, 302, etc.)
    if (status >= 300 && status < 400) {
      Serial.print("[HTTP] ERROR: Server sent redirect (status ");
      Serial.print(status);
      Serial.println("). ESP32 cannot follow redirects.");
      if (status == 307 || status == 301 || status == 302) {
        Serial.println("[HTTP] HINT: Your ngrok URL might be redirecting HTTP to HTTPS.");
        Serial.println("[HTTP] SOLUTION: Check if your server requires HTTPS instead of HTTP.");
        lcd_show("Redirect Error", "Check URL");
      }
      // Don't retry - redirect will keep happening
      break;
    }
    
    // Handle 401/403 errors (authorization issues) - might need re-provisioning
    if (status == 401 || status == 403) {
      Serial.println("[HTTP] ERROR: Authorization failed. Device token may be invalid or revoked.");
      lcd_show("Auth Failed", "Need provision");
      // Don't retry with same credentials
      break;
    }
    
    // Timeout or connection error
    if (status == -3 || status == -2 || status == -1) {
      Serial.print("[HTTP] Network error: "); Serial.println(status);
      if (attempt < 3) {
        uint32_t backoff = attempt * 500; // 500ms, 1000ms
        Serial.print("[HTTP] Backing off "); Serial.print(backoff); Serial.println("ms...");
        delay(backoff);
      }
      continue;
    }
    
    // Other errors (4xx, 5xx) - no retry
    break;
  }

  // Clear one-shot flag after final attempt
  g_force_beep_request = false;

  Serial.print("[HTTP] Final status="); Serial.println(status);
  Serial.print("[HTTP] Response="); Serial.println(resp);

  // Track consecutive failures for diagnostics
  if (status < 200 || status >= 300) {
    consecutive_failures++;
    if (consecutive_failures >= 5) {
      Serial.println("[WARN] 5+ consecutive HTTP failures - check backend connection");
      lcd_show("HTTP Fails", "Check backend");
      delay(2000);
    }
    g_http_consecutive_failures++;
  }
  else {
    g_last_http_success_ms = millis();
    g_http_consecutive_failures = 0;
  }

  // Check if backend asks us to beep (expects JSON like {\"status\":\"ok\",\"beep\":true})
  bool shouldBeep = (resp.indexOf("\"beep\":true") >= 0);
  if (shouldBeep) {
    Serial.println("[ALERT] Boundary violation detected -> Beeper ON");
    lcd_show("ALERT!", "Dwell 15min");
    // Start non-blocking beep so network loop is not delayed
    beep_start(BEEP_CYCLES, BEEP_ON_MS, BEEP_OFF_MS);
  }

  // Check if we need to update any config from server response
  if (status >= 200 && status < 300) {
    // Look for configuration update directives in response
    if (resp.indexOf("\"update_config\":true") >= 0) {
      Serial.println("[HTTP] Server requested configuration update!");
      lcd_show("Config Update", "Requested");
      // This could trigger a firmware-initiated config update process
    }
  }

  g_last_http_code = status;
  char l2[17];
  if (status >= 200 && status < 300) snprintf(l2, sizeof(l2), "Sent:OK %d", status);
  else snprintf(l2, sizeof(l2), "Sent:ERR %d", status);
  lcd_status(l2);

  return (status >= 200 && status < 300);
}

// ======= GPS TIME → UNIX HELPERS =======

static bool isLeapYear(int year) {
  return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
}

static uint32_t unixTimeFromYMDHMS(int year, int month, int day,
                                   int hour, int minute, int second) {
  static const uint8_t daysInMonth[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  uint32_t days = 0;

  for (int y = 1970; y < year; ++y) {
    days += isLeapYear(y) ? 366UL : 365UL;
  }

  for (int m = 1; m < month; ++m) {
    days += daysInMonth[m - 1];
    if (m == 2 && isLeapYear(year)) {
      days += 1;
    }
  }

  days += (day - 1);

  uint32_t seconds = days * 86400UL;
  seconds += hour * 3600UL;
  seconds += minute * 60UL;
  seconds += second;

  return seconds;
}

// Parse UTC time from +CGNSINF / +UGNSINF third field (YYYYMMDDHHMMSS.sss)
static bool parse_cgnsinf_time(const String &resp, uint32_t &unixTimeOut) {
  int idx = resp.indexOf("+CGNSINF:");
  if (idx < 0) idx = resp.indexOf("+UGNSINF:");
  if (idx < 0) return false;

  int end = resp.indexOf('\n', idx);
  String line = (end > idx) ? resp.substring(idx, end) : resp.substring(idx);

  int colon = line.indexOf(':');
  String data = (colon >= 0) ? line.substring(colon + 1) : line;

  int token = 0;
  int start = 0;

  for (int i = 0; i <= data.length(); ++i) {
    if (i == data.length() || data[i] == ',') {
      String t = data.substring(start, i);
      t.trim();

      if (token == 2) {  // UTC field
        if (t.length() < 14) return false;
        String s = t.substring(0, 14);

        int year   = s.substring(0, 4).toInt();
        int month  = s.substring(4, 6).toInt();
        int day    = s.substring(6, 8).toInt();
        int hour   = s.substring(8, 10).toInt();
        int minute = s.substring(10, 12).toInt();
        int second = s.substring(12, 14).toInt();

        unixTimeOut = unixTimeFromYMDHMS(year, month, day, hour, minute, second);
        return true;
      }

      token++;
      start = i + 1;
    }
  }

  return false;
}

// ======= POLYGON GEOFENCE + MOVEMENT-AWARE IDLE DETECTION =======

// Dynamic geofence boundary variables declared at top of file (lines 218-221)

static double deg2rad(double deg) {
  return deg * 3.14159265358979323846 / 180.0;
}

static double haversine_meters(double lat1, double lon1,
                               double lat2, double lon2) {
  const double R = 6371000.0; // Earth radius in meters
  double phi1 = deg2rad(lat1);
  double phi2 = deg2rad(lat2);
  double dphi = deg2rad(lat2 - lat1);
  double dlambda = deg2rad(lon2 - lon1);

  double a = sin(dphi * 0.5) * sin(dphi * 0.5) +
             cos(phi1) * cos(phi2) *
             sin(dlambda * 0.5) * sin(dlambda * 0.5);
  double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  return R * c;
}

// Save dynamic polygon to NVS
static void geofence_save_polygon() {
  if (!g_geofence_polygon || g_geofence_vertices == 0) {
    Serial.println("[GEOFENCE] No polygon to save");
    return;
  }
  
  geoPrefs.putUInt("poly_verts", g_geofence_vertices);
  
  for (size_t i = 0; i < g_geofence_vertices; i++) {
    char lat_key[16], lng_key[16];
    snprintf(lat_key, sizeof(lat_key), "poly_lat_%u", (unsigned)i);
    snprintf(lng_key, sizeof(lng_key), "poly_lng_%u", (unsigned)i);
    geoPrefs.putDouble(lat_key, g_geofence_polygon[i].lat);
    geoPrefs.putDouble(lng_key, g_geofence_polygon[i].lon);
  }
  
  Serial.printf("[GEOFENCE] Saved polygon: %u vertices\n", (unsigned)g_geofence_vertices);
}

// Load dynamic polygon from NVS
static bool geofence_load_polygon() {
  g_geofence_vertices = geoPrefs.getUInt("poly_verts", 0);
  
  if (g_geofence_vertices == 0 || g_geofence_vertices > MAX_GEOFENCE_VERTICES) {
    Serial.printf("[GEOFENCE] No valid polygon in NVS (vertices=%u)\n", (unsigned)g_geofence_vertices);
    g_geofence_vertices = 0;
    return false;
  }
  
  // Allocate memory for polygon
  if (g_geofence_polygon) {
    free(g_geofence_polygon);
  }
  g_geofence_polygon = (GeoPoint*)malloc(g_geofence_vertices * sizeof(GeoPoint));
  
  if (!g_geofence_polygon) {
    Serial.println("[GEOFENCE] ERROR: Failed to allocate polygon memory");
    g_geofence_vertices = 0;
    return false;
  }
  
  // Load points
  for (size_t i = 0; i < g_geofence_vertices; i++) {
    char lat_key[16], lng_key[16];
    snprintf(lat_key, sizeof(lat_key), "poly_lat_%u", (unsigned)i);
    snprintf(lng_key, sizeof(lng_key), "poly_lng_%u", (unsigned)i);
    g_geofence_polygon[i].lat = geoPrefs.getDouble(lat_key, 0.0);
    g_geofence_polygon[i].lon = geoPrefs.getDouble(lng_key, 0.0);
  }
  
  Serial.printf("[GEOFENCE] Loaded polygon: %u vertices from NVS\n", (unsigned)g_geofence_vertices);
  return true;
}

// Fetch geofence boundary from backend during provisioning
static bool geofence_fetch_from_backend() {
  if (g_cfg.device_id.length() == 0) {
    Serial.println("[GEOFENCE] ERROR: No device_id configured");
    return false;
  }
  
  Serial.println("[GEOFENCE] Fetching boundary from backend...");
  lcd_show("Provisioning", "Fetch Boundary");
  
  // Ensure we're in command mode
  // Ensure PPP connection
  if (!PPPOS_isConnected()) {
    Serial.println("[GEOFENCE] Connecting PPP for boundary fetch...");
    if (!modem_dial() || !ppp_connect_blocking(PPP_CONNECT_TIMEOUT_MS)) {
      Serial.println("[GEOFENCE] ERROR: PPP connection failed");
      return false;
    }
  }
  
  // Build HTTP GET request
  String path = "/api/device-boundary/" + g_cfg.device_id + "/";
  
  Serial.printf("[GEOFENCE] GET http://%s:%d%s\n", g_cfg.host.c_str(), g_cfg.port, path.c_str());
  
  // Retry up to 3 times with increasing timeout
  int statusCode = 0;
  int err = -1;
  String response = "";
  
  for (int attempt = 1; attempt <= 3; attempt++) {
    uint32_t timeout = 15000 + (attempt * 5000); // 20s, 25s, 30s
    
    Serial.printf("[GEOFENCE] Attempt %d/3 (timeout=%dms)\n", attempt, timeout);
    
    // Create raw HTTP request with ngrok headers
    if (!pppClient.connect(g_cfg.host.c_str(), g_cfg.port)) {
      Serial.println("[GEOFENCE] ERROR: Connection failed");
      err = -1;
      if (attempt < 3) {
        Serial.println("[GEOFENCE] Retrying...");
        delay(2000);
      }
      continue;
    }
    
    Serial.println("[GEOFENCE] Connected to server, sending request...");
    
    // Send HTTP GET request with headers
    pppClient.printf("GET %s HTTP/1.1\r\n", path.c_str());
    pppClient.printf("Host: %s\r\n", g_cfg.host.c_str());
    pppClient.println("User-Agent: ESP32-Tracker/1.0");
    pppClient.println("ngrok-skip-browser-warning: true");
    pppClient.println("Connection: close");
    pppClient.println();
    
    Serial.println("[GEOFENCE] Request sent, waiting for response...");
    
    // Wait for response with timeout
    unsigned long start = millis();
    while (!pppClient.available() && (millis() - start < timeout)) {
      delay(10);
    }
    
    if (!pppClient.available()) {
      Serial.println("[GEOFENCE] ERROR: Response timeout");
      pppClient.stop();
      err = -1;
      if (attempt < 3) {
        Serial.println("[GEOFENCE] Retrying...");
        delay(2000);
      }
      continue;
    }
    
    // Read status line
    String statusLine = pppClient.readStringUntil('\n');
    statusLine.trim();
    Serial.printf("[GEOFENCE] Status: %s\n", statusLine.c_str());
    
    // Extract status code
    if (statusLine.startsWith("HTTP/1.")) {
      int firstSpace = statusLine.indexOf(' ');
      int secondSpace = statusLine.indexOf(' ', firstSpace + 1);
      if (firstSpace > 0 && secondSpace > firstSpace) {
        statusCode = statusLine.substring(firstSpace + 1, secondSpace).toInt();
        Serial.printf("[GEOFENCE] HTTP Status: %d\n", statusCode);
      }
    }
    
    // Skip headers
    while (pppClient.available()) {
      String line = pppClient.readStringUntil('\n');
      line.trim();
      if (line.length() == 0) break; // Empty line = end of headers
    }
    
    // Read body with timeout loop to allow JSON to arrive fully
    response = "";
    unsigned long bodyStart = millis();
    while (millis() - bodyStart < timeout) {
      // Drain any available bytes into the response buffer
      while (pppClient.available()) {
        int c = pppClient.read();
        if (c < 0) break;
        response += (char)c;
      }
      // If the server closed the connection and we already have data, stop
      if (!pppClient.connected() && response.length() > 0) {
        break;
      }
      // If we already have some data and no more is arriving, a short
      // idle wait is enough before we stop (avoid burning CPU)
      delay(10);
    }

    pppClient.stop();
    
    if (statusCode == 200 && response.length() > 0) {
      err = 0;
      break; // Success!
    } else {
      err = statusCode > 0 ? statusCode : -1;
    }
    
    if (attempt < 3) {
      Serial.println("[GEOFENCE] Retrying...");
      delay(2000);
    }
  }
  
  if (err != 0) {
    Serial.printf("[GEOFENCE] All attempts failed. Last error: %d\n", err);
    Serial.println("[GEOFENCE] Check: Network connection, server URL, firewall");
    return false;
  }
  
  // Check status code
  if (statusCode != 200) {
    Serial.println("[GEOFENCE] ERROR: Server returned non-200 status");
    Serial.println(response);
    return false;
  }
  
  Serial.printf("[GEOFENCE] Response length: %d bytes\n", response.length());
  
  // Debug: print first 200 chars of response
  if (response.length() > 0) {
    String preview = response.substring(0, min((int)response.length(), 200));
    Serial.printf("[GEOFENCE] Response preview: %s...\n", preview.c_str());
  }
  
  // Parse JSON response
  DynamicJsonDocument doc(8192);  // 8KB for boundary JSON
  DeserializationError error = deserializeJson(doc, response);
  
  if (error) {
    Serial.printf("[GEOFENCE] JSON parse error: %s\n", error.c_str());
    return false;
  }
  
  // Extract polygon array
  if (!doc.containsKey("geofence") || !doc["geofence"].containsKey("polygon")) {
    Serial.println("[GEOFENCE] ERROR: Response missing geofence.polygon");
    return false;
  }
  
  JsonArray polygon = doc["geofence"]["polygon"];
  size_t vertices = polygon.size();
  
  if (vertices == 0 || vertices > MAX_GEOFENCE_VERTICES) {
    Serial.printf("[GEOFENCE] ERROR: Invalid vertex count: %u\n", (unsigned)vertices);
    return false;
  }
  
  // Allocate new polygon
  if (g_geofence_polygon) {
    free(g_geofence_polygon);
  }
  g_geofence_polygon = (GeoPoint*)malloc(vertices * sizeof(GeoPoint));
  
  if (!g_geofence_polygon) {
    Serial.println("[GEOFENCE] ERROR: Failed to allocate memory");
    g_geofence_vertices = 0;
    return false;
  }
  
  // Parse polygon points [lat, lng]
  g_geofence_vertices = vertices;
  for (size_t i = 0; i < vertices; i++) {
    JsonArray point = polygon[i];
    g_geofence_polygon[i].lat = point[0].as<double>();
    g_geofence_polygon[i].lon = point[1].as<double>();
  }
  
  // Print info
  String municipality = doc["municipality"]["name"] | "Unknown";
  Serial.printf("[GEOFENCE] ✅ Loaded %s boundary: %u vertices\n", 
                municipality.c_str(), (unsigned)g_geofence_vertices);
  
  // Save to NVS
  geofence_save_polygon();
  
  lcd_show("Boundary OK", municipality.c_str());
  delay(2000);
  
  return true;
}

// Ray-casting point-in-polygon
static bool pointInPolygon(double lat, double lon, const GeoPoint* polygon, size_t vertexCount) {
  bool inside = false;

  for (size_t i = 0, j = vertexCount - 1; i < vertexCount; j = i++) {
    double lat_i = polygon[i].lat;
    double lon_i = polygon[i].lon;
    double lat_j = polygon[j].lat;
    double lon_j = polygon[j].lon;

    bool intersect = ((lat_i > lat) != (lat_j > lat)) &&
                     (lon < (lon_j - lon_i) * (lat - lat_i) / (lat_j - lat_i + 1e-12) + lon_i);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// Persist outsideState + idleStartTime + last GPS position to NVS
static void geofence_save_state() {
  geoPrefs.putBool("outside", g_outside_state);
  geoPrefs.putULong("idleStart", g_boundary_exit_time);
  geoPrefs.putFloat("lastLat", g_idle_base_lat);
  geoPrefs.putFloat("lastLng", g_idle_base_lng);
  geoPrefs.putBool("hasLast", g_has_idle_base);
  geoPrefs.putULong("lastUnix", g_last_gps_unix);
  geoPrefs.putBool("violated", g_violation_triggered);  // CRITICAL: Save violation flag
  geoPrefs.putULong("violTime", g_violation_timestamp); // Save violation timestamp for 24hr cooldown
  Serial.printf("[GEOFENCE] Saved: outside=%d idleStart=%u hasLast=%d violated=%d violTime=%u lat=%.6f lon=%.6f\n",
                g_outside_state,
                (unsigned)g_boundary_exit_time,
                g_has_idle_base,
                g_violation_triggered,
                (unsigned)g_violation_timestamp,
                (double)g_idle_base_lat,
                (double)g_idle_base_lng);
}

static void geofence_load_state() {
  g_outside_state      = geoPrefs.getBool("outside", false);
  g_boundary_exit_time = geoPrefs.getULong("idleStart", 0);
  g_idle_base_lat      = geoPrefs.getFloat("lastLat", 0.0f);
  g_idle_base_lng      = geoPrefs.getFloat("lastLng", 0.0f);
  g_has_idle_base      = geoPrefs.getBool("hasLast", false);
  g_last_gps_unix      = geoPrefs.getULong("lastUnix", 0);
  g_violation_triggered = geoPrefs.getBool("violated", false);  // CRITICAL: Load violation flag from NVS
  g_violation_timestamp = geoPrefs.getULong("violTime", 0);    // Load violation timestamp

  Serial.printf("[GEOFENCE] Loaded: outside=%d idleStart=%u hasLast=%d violated=%d violTime=%u lat=%.6f lon=%.6f lastUnix=%u\n",
                g_outside_state,
                (unsigned)g_boundary_exit_time,
                g_has_idle_base,
                g_violation_triggered,
                (unsigned)g_violation_timestamp,
                (double)g_idle_base_lat,
                (double)g_idle_base_lng,
                (unsigned)g_last_gps_unix);
}

// Local violation handler (device-side; independent of backend)
static void geofence_trigger_violation(uint32_t nowUnix, double lat, double lon) {
  // Check if violation was triggered in the last 24 hours (86400 seconds)
  const uint32_t VIOLATION_COOLDOWN_SECONDS = 24UL * 60UL * 60UL; // 24 hours
  
  if (g_violation_triggered && g_violation_timestamp > 0) {
    uint32_t time_since_violation = nowUnix - g_violation_timestamp;
    if (time_since_violation < VIOLATION_COOLDOWN_SECONDS) {
      uint32_t hours_remaining = (VIOLATION_COOLDOWN_SECONDS - time_since_violation) / 3600;
      Serial.printf("[GEOFENCE] Violation already triggered today, cooldown: %u hours remaining\n", 
                    (unsigned)hours_remaining);
      return;  // only once per 24 hours
    } else {
      Serial.println("[GEOFENCE] 24-hour cooldown expired, allowing new violation");
    }
  }

  g_violation_triggered = true;
  g_violation_timestamp = nowUnix;  // Record when violation was triggered
  geofence_save_state();  // CRITICAL: Save violation flag and timestamp immediately to NVS

  Serial.println("***** GEOFENCE VIOLATION (MOVEMENT-IDLE) *****");
  Serial.printf("time=%u lat=%.6f lon=%.6f\n", (unsigned)nowUnix, lat, lon);
  Serial.println("*********************************************");

  lcd_show("ALERT!", "Idle 15m Outside");
  beep_start(BEEP_CYCLES, BEEP_ON_MS, BEEP_OFF_MS);
}

// Core state machine:
// - Track when boat is OUTSIDE polygon
// - If distance between consecutive fixes <= 50m for 15+ minutes while outside -> violation
// - Any step > 50m while outside resets idle timer
static void geofence_process(double lat, double lon, uint32_t nowUnix) {
  if (nowUnix == 0) {
    Serial.println("[GEOFENCE] GPS time not available; skipping.");
    return;
  }
  
  // Check if polygon is loaded
  if (!g_geofence_polygon || g_geofence_vertices == 0) {
    // No polygon configured - skip geofence checks
    return;
  }

  bool inside = pointInPolygon(lat, lon, g_geofence_polygon, g_geofence_vertices);

  if (inside) {
    if (g_outside_state || g_boundary_exit_time != 0 || g_has_idle_base) {
      g_outside_state       = false;
      g_boundary_exit_time  = 0;
      g_has_idle_base       = false;
      g_violation_triggered = false;
      geofence_save_state();
      Serial.println("[GEOFENCE] Re-entered polygon; timers cleared.");
    }
    return;
  }

  // Outside polygon from here on
  if (!g_outside_state) {
    g_outside_state       = true;
    g_boundary_exit_time  = 0;     // will start when we first confirm idle
    g_violation_triggered = false;
    // do not save yet; we'll save after updating last position
    Serial.println("[GEOFENCE] Just left polygon; entering outside state.");
  }

  double stepDist = 0.0;
  bool   havePrev = g_has_idle_base;

  if (havePrev) {
    stepDist = haversine_meters(g_idle_base_lat, g_idle_base_lng, lat, lon);
  }

  bool isIdleStep = havePrev && (stepDist <= IDLE_DISTANCE_THRESHOLD_METERS);

  if (!havePrev) {
    // First outside fix (after reset/reboot or after coming from inside): store as baseline
    Serial.println("[GEOFENCE] First outside fix; waiting for next fix to evaluate movement.");
  } else if (!isIdleStep) {
    // Movement detected: reset idle timer
    Serial.printf("[GEOFENCE] Movement detected: %.1f m > %.1f m; idle timer reset.\n",
                  stepDist, (double)IDLE_DISTANCE_THRESHOLD_METERS);
    g_boundary_exit_time  = 0;
    g_violation_triggered = false;
  } else {
    // Idle step while outside polygon
    if (g_boundary_exit_time == 0) {
      g_boundary_exit_time = nowUnix;  // start idle timer
      Serial.printf("[GEOFENCE] Idle-outside period started at %u\n", (unsigned)g_boundary_exit_time);
    } else {
      uint32_t elapsed = nowUnix - g_boundary_exit_time;
      Serial.printf("[GEOFENCE] Idle outside for %u seconds\n", (unsigned)elapsed);
      if (!g_violation_triggered && elapsed >= VIOLATION_TIMEOUT_SECONDS) {
        geofence_trigger_violation(nowUnix, lat, lon);
      }
    }
  }

  // Update last-known outside fix for next step and persist
  g_idle_base_lat  = (float)lat;
  g_idle_base_lng  = (float)lon;
  g_has_idle_base  = true;
  geofence_save_state();
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\n[ESP32 PPPoS] Booting...");
  Serial.println("\n=== SIMPLIFIED PROVISIONING ===");
  Serial.println("Step 1: DEVICE_ID=your-tracker-id");
    Serial.println("Step 2: TOKEN=your-device-token");
  Serial.println("Step 3: PROVISION");
  Serial.println("\nOptional commands:");
  Serial.println("- INFO (show current config)");
  Serial.println("- FETCH_BOUNDARY (fetch boundary after modem ready)");
  Serial.println("- RESET (erase all settings)");
  Serial.println("- beep-now (test buzzer)");
  Serial.println("\nHost defaults to: unskilfully-unsoftening-flynn.ngrok-free.dev");
  randomSeed(micros());

  // LCD init
  lcd_setup();

  // Load stored provisioning
  cfg_load();

  // Open geofence NVS namespace and load persistent geofence/idle state
  if (geoPrefs.begin("geofence", false)) {  // read-write
    geofence_load_state();
    // Load dynamic polygon from NVS (fetched during provisioning)
    if (!geofence_load_polygon()) {
      Serial.println("[GEOFENCE] WARNING: No boundary polygon configured");
      Serial.println("[GEOFENCE] Run PROVISION command to fetch boundary from backend");
    }
  } else {
    Serial.println("[GEOFENCE] ERROR: Failed to open NVS namespace 'geofence'");
  }

  // Print current config for provisioning verification (frontend expects [INFO] TOKEN=...)
  Serial.print("[INFO] TOKEN=");
  Serial.println(g_cfg.token.length() ? g_cfg.token : "(empty)");
  Serial.print("[INFO] HOST=");
  Serial.println(g_cfg.host.length() ? g_cfg.host : "(empty)");
  Serial.print("[INFO] PORT=");
  Serial.println(g_cfg.port > 0 ? String(g_cfg.port) : "(not set)");
  Serial.print("[INFO] PATH=");
  Serial.println(g_cfg.path.length() ? g_cfg.path : "(empty)");
  
  if (!g_provisioned) {
    lcd_show("Provision", "Needed");
    Serial.println("\n[PROV] Not provisioned. Send DEVICE_ID and TOKEN commands.");
    Serial.println("[PROV] Example: DEVICE_ID=BAC-0001");
    Serial.println("[PROV] Example: TOKEN=a1b2c3d4...");
    Serial.println("[PROV] Then send: PROVISION");
    Serial.println("[PROV] Waiting for provisioning commands...");
    
    // Wait for provisioning commands (check every 100ms)
    while (!g_provisioned) {
      if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) {
          Serial.printf("[PROV] Received: %s\n", line.c_str());
          
          // Parse KEY=VALUE format
          int eq = line.indexOf('=');
          if (eq > 0) {
            String key = line.substring(0, eq);
            String val = line.substring(eq + 1);
            cfg_set_kv(key, val);
          } else if (line.equalsIgnoreCase("PROVISION") || line.equalsIgnoreCase("STORE_CREDENTIALS")) {
            cfg_set_kv("PROVISION", "");
          } else if (line.equalsIgnoreCase("INFO")) {
            cfg_print();
          } else if (line.equalsIgnoreCase("RESET") || line.equalsIgnoreCase("ERASE")) {
            cfg_set_kv("RESET", "");
          }
        }
      }
      delay(100);
      
      // Update LCD with waiting animation
      static uint8_t dots = 0;
      if (millis() % 1000 < 100) {
        char line2[17];
        dots = (dots + 1) % 4;
        snprintf(line2, sizeof(line2), "Waiting%.*s", dots, "...");
        lcd_show("Provision", line2);
      }
    }
    
    Serial.println("[PROV] Provisioning complete! Continuing with startup...");
    lcd_show("Provision", "OK");
  } else {
    lcd_show("Provision", "OK");
    Serial.println("\n[PROV] Device provisioned successfully!");
    Serial.printf("[PROV] Device ID: %s\n", g_cfg.device_id.c_str());
    Serial.printf("[PROV] Host: %s:%d%s\n", g_cfg.host.c_str(), g_cfg.port, g_cfg.path.c_str());
  }

  // Buzzer init
  beeper_init();

  // Perform one-time cold reset for GNSS to speed up TTFF
  gnss_cold_reset_once();

  // Optional: give GNSS an initial window to acquire a fix before we enable PPP
  initial_gps_lock_window(INITIAL_GPS_LOCK_MS);

  // 1) Dial and enter data mode
  if (!modem_dial()) {
    Serial.println("[Modem] Dial failed. Check wiring, SIM, and power.");
    return;
  }

  // 2) Start PPP and wait for IP
  if (!ppp_connect_blocking(PPP_CONNECT_TIMEOUT_MS)) {
    Serial.println("[PPP] Could not establish IP session.");
    return;
  }
  
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
}

static uint32_t nextSendDue = 0;

static void _serial_poll_for_tests() {
  if (!Serial.available()) return;
  String raw = Serial.readStringUntil('\n');
  raw.trim();

  String cmdLower = raw; cmdLower.toLowerCase();
  if (cmdLower == "beep") {
    g_force_beep_request = true;  // server will set beep flag in response
    lcd_show("Test", "Beep req");
    beep_quick(3, 120, 120);
    Serial.println("[TEST] force_beep set for next POST");
    return;
  }
  if (cmdLower == "beep-now") {
    lcd_show("Test", "Beep now");
    beep_quick(5, 120, 120);
    return;
  }
  if (cmdLower == "info") { cfg_print(); return; }
  if (cmdLower == "fetch_boundary" || cmdLower == "fetch") {
    cfg_set_kv("FETCH_BOUNDARY", "");
    return;
  }
  
  // RESET/ERASE command - clear all stored configuration
  if (cmdLower == "reset" || cmdLower == "erase") {
    Serial.println("[CMD] Erasing configuration...");
    cfg_set_kv("RESET", "");
    lcd_show("Config", "Erased");
    Serial.println("[CMD] Configuration erased. Press reset button to provision.");
    delay(2000);
    ESP.restart();
    return;
  }
  
  // PROVISION command - finalize and save configuration
  if (cmdLower == "provision" || cmdLower == "store_credentials") {
    Serial.println("[CMD] Saving configuration...");
    cfg_set_kv("PROVISION", "");
    return;
  }

  // Provisioning: accept KEY=VALUE lines (TOKEN, HOST, PORT, PATH, DEVICE_ID)
  int eq = raw.indexOf('=');
  if (eq > 0) {
    String key = raw.substring(0, eq); key.trim();
    String val = raw.substring(eq + 1); val.trim();
    cfg_set_kv(key, val);
    // Briefly show status on LCD if available
    if (lcdReady) { String msg = String("Set ") + key; lcd_show("Provision", msg.c_str()); }
  }
}

void loop() {
  _serial_poll_for_tests();
  // service non-blocking beeper every tick
  beep_update();
  
  if (millis() < nextSendDue) {
    delay(10);
    return;
  }
  // schedule next send with small jitter to avoid synced bursts after reboot
  nextSendDue = millis() + SEND_INTERVAL_MS + (uint32_t)random(0, SEND_JITTER_MS + 1);

  // Dynamically reduce GNSS escapes when network is healthy to minimize PPP flips
  // - If we have multiple HTTP failures, increase frequency to every loop for faster recovery
  // - If stable for > 2 minutes, lower frequency to every 3 loops to reduce reconnection pressure
  if (g_http_consecutive_failures >= 2) {
    g_escape_every_n = 1;
  } else {
    if (g_last_http_success_ms > 0 && (millis() - g_last_http_success_ms) > 120000UL) {
      // stale success; keep GPS frequent
      g_escape_every_n = 1;
    } else {
      g_escape_every_n = GPS_ESCAPE_EVERY_N_DEFAULT; // normal
    }
  }

  // 1) Read GPS while keeping PPP up: escape to AT only on selected cycles
  if (FLIGHT_MODE_DURING_GPS) {
    cell_set_flight_mode(true);
  }

  bool shouldEscapeForGps = ((g_loop_counter++ % g_escape_every_n) == 0);

  // Before reading coords, optionally query CGNSINF to show status on LCD
  int run = 0, fix = 0; float latTry = 0, lngTry = 0; float hdopSeen = 0; int satsUsed = 0;
   bool haveCGNS = false;
  if (shouldEscapeForGps) {
    ensure_command_mode();
    lcd_spinner("GPS: Query", "CGNSINF...");
    gps_power_on();
    String cgns = ppp_send_and_read("AT+CGNSINF", 5000);
    Serial.print("[GNSS] ");
    Serial.println(cgns);
    /* gnss_diagnostics(); */  // Skip extra diagnostics each loop to save time

    // Parse location + HDOP/sats
    haveCGNS = parse_cgnsinf_ex(cgns, run, fix, latTry, lngTry, hdopSeen, satsUsed);

    // Parse GPS UTC → Unix timestamp (reconnect-proof timing)
    uint32_t unixTs = 0;
    if (parse_cgnsinf_time(cgns, unixTs)) {
      g_last_gps_unix = unixTs;
      // Persist last GPS time so idle timer survives reboots
      geoPrefs.putULong("lastUnix", g_last_gps_unix);
      Serial.printf("[GNSS] Unix time parsed: %u\n", (unsigned)g_last_gps_unix);
    }

    if (haveCGNS) {
      if (run == 1 && fix == 0) {
        char l2[17]; snprintf(l2, sizeof(l2), "u:%d hd:%.1f", satsUsed, hdopSeen);
        lcd_show("GPS: Searching", l2);
      } else if (run == 0) {
        lcd_status("GPS Off");
      }
    }
  }

  float lat = 0.0f, lng = 0.0f;
  bool got = false;
  
  // Try to get current GPS fix
  // Try to get current GPS fix
  if (haveCGNS && run == 1 && fix == 1 && (latTry != 0.0f || lngTry != 0.0f)) {
    lat = latTry; lng = lngTry; got = true;
  } else {
    if (shouldEscapeForGps) {
      got = gps_get_coords(lat, lng);
    } else if (g_has_last_known_position) {
      // Use recent last known between full GNSS polls to keep map flowing
      lat = g_last_known_lat;
      lng = g_last_known_lng;
      got = true;
    }
  }

  if (got) {
    // Store this as last known position
    g_last_known_lat = lat;
    g_last_known_lng = lng;
    g_has_last_known_position = true;
    
    char line[17];
    snprintf(line, sizeof(line), "Lat:%2.5f", lat);
    char line2[17];
    snprintf(line2, sizeof(line2), "Lng:%3.5f", lng);
    lcd_show("GPS: FIX", line);
    delay(200);
    lcd_show("GPS: FIX", line2);

    // Run reconnect-proof, movement-aware geofence logic
    if (g_last_gps_unix > 0) {
      geofence_process(lat, lng, g_last_gps_unix);
    } else {
      Serial.println("[GEOFENCE] GPS time not yet valid; skipping geofence update.");
    }
  } else {
    // No current fix - try to use last known position
    if (g_has_last_known_position) {
      lat = g_last_known_lat;
      lng = g_last_known_lng;
      got = true;
      lcd_status("GPS: Last Known");
      Serial.println("[GPS] Using last known position");
    } else {
      // No GPS fix and no last known position
      if (!(haveCGNS && run == 1 && fix == 0)) {
        lcd_status("GPS Searching");
      }
      Serial.println("[GPS] No fix available, skipping this send cycle");
    }
  }

  if (FLIGHT_MODE_DURING_GPS) {
    cell_set_flight_mode(false);
  }

  // 2) Return to data mode and ensure PPP is up (only if we escaped this loop)
  bool dataMode = true;
  if (shouldEscapeForGps) {
    dataMode = resume_data_mode();
  }
  if (!dataMode) {
    Serial.println("[PPP] ATO failed; falling back to re-dial");
    if (!modem_dial() || !ppp_connect_blocking(PPP_CONNECT_TIMEOUT_MS)) {
      Serial.println("[PPP] Could not re-connect after GPS read.");
      return;
    }
  } else {
    if (!PPPOS_isConnected()) {
      Serial.println("[PPP] Resuming PPP...");
      if (!ppp_connect_blocking(PPP_CONNECT_TIMEOUT_MS)) {
        Serial.println("[PPP] PPP resume failed; re-dialing");
        if (!modem_dial() || !ppp_connect_blocking(PPP_CONNECT_TIMEOUT_MS)) {
          Serial.println("[PPP] Could not re-connect after GPS read.");
          return;
        }
      }
    }
  }

  // 3) POST latest GPS only if we have valid coordinates (small settle if we resumed with ATO)
  if (got) {
    delay(200);
    bool ok = http_post_position(lat, lng);
    if (!ok) {
      Serial.println("[Send] POST failed. Will retry next interval.");
    }
  } else {
    Serial.println("[Send] Skipping POST - no valid GPS coordinates available");
    lcd_status("Skip: No GPS");
  }
}
