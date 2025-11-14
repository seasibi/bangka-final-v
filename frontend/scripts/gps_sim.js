#!/usr/bin/env node
/**
 * Two GPS tracker simulation for San Fernando ➜ San Juan context.
 * - Emits periodic location updates with heading and timestamp
 * - Generates events: online, offline, reconnecting, pass_through (enter/exit), idle, violation
 * - Idle threshold: 15m prod, 1m test override (--test)
 * - Produces histories per tracker, notification log, and CSV/JSON reports
 *
 * Usage:
 *   node scripts/gps_sim.js --test            # 1-minute idle threshold, shorter run
 *   node scripts/gps_sim.js --durationSec=600 # custom run duration
 *   node scripts/gps_sim.js --intervalMs=3000 # custom update interval
 *   node scripts/gps_sim.js --post --api=http://localhost:8000 \
 *        --token1=... --token2=... --mfbr1=SJU-0001 --mfbr2=SJU-0002
 *
 * Env alternatives: API_URL, TOKEN1, TOKEN2, MFBR1, MFBR2
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Geo Context -------------------- //
// Approximate coordinates
const LOCATIONS = {
  CityOfsanFernando: { lat: 16.6159, lng: 120.3176 }, // allowed area center
  sanJuan:     { lat: 16.6730, lng: 120.3447 }, // other/restricted area center
};

// Circular geofences (meters)
const GEOFENCE = {
  allowed: { center: LOCATIONS.CityOfsanFernando, radiusM: 5000 }, // ~5 km
  other:   { center: LOCATIONS.sanJuan,     radiusM: 3000 }, // ~3 km
};

// -------------------- Config -------------------- //
const args = Object.fromEntries(process.argv.slice(2).map(kv => {
  const [k, v] = kv.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));

const TEST_MODE = !!args.test;
const INTERVAL_MS = Number(args.intervalMs || 5000); // 5s default
const RUN_DURATION_SEC = Number(args.durationSec || (TEST_MODE ? 180 : 900)); // 3 min test, 15 min prod default run
const IDLE_THRESHOLD_MS = TEST_MODE ? 60_000 : 15 * 60_000; // 1m test vs 15m prod
const IDLE_DRIFT_M = 25; // within 25m counts as idle

// Posting to backend ingest (configured after args)
const SHOULD_POST = !!args.post;
const API_BASE = String(args.api || process.env.API_URL || 'http://localhost:8000').replace(/\/$/, '');
const INGEST_URL = `${API_BASE}/api/ingest/v1/positions/`;
const TOKENS = {
  'TRK-001': String(args.token1 || process.env.TOKEN1 || ''),
  'TRK-002': String(args.token2 || process.env.TOKEN2 || ''),
};
const MFBR = {
  'TRK-001': String(args.mfbr1 || process.env.MFBR1 || ''),
  'TRK-002': String(args.mfbr2 || process.env.MFBR2 || ''),
};

function postJSON(url, body, headers={}) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const data = Buffer.from(JSON.stringify(body));
      const opts = {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          ...headers,
        },
        rejectUnauthorized: false,
      };
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(opts, (res) => {
        let out = '';
        res.setEncoding('utf8');
        res.on('data', (d) => out += d);
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      });
      req.on('error', () => resolve({ status: 0, body: '' }));
      req.write(data);
      req.end();
    } catch (_) {
      resolve({ status: 0, body: '' });
    }
  });
}

// Output directory
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// -------------------- Utilities -------------------- //
function toRad(d) { return d * Math.PI / 180; }
function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}
function bearingFromTo(a, b) {
  const lat1 = toRad(a.lat); const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
}
function inCircle(pos, fence) { return haversine(pos, fence.center) <= fence.radiusM; }
function nowISO() { return new Date().toISOString(); }
function fmt(ts) { return new Date(ts).toLocaleString(); }
function rnd(min, max) { return Math.random() * (max - min) + min; }
function jitterMeters(pos, m) {
  // Roughly convert meters to degrees
  const dLat = (m / 111320) * (Math.random() < 0.5 ? -1 : 1) * Math.random();
  const dLng = (m / (111320 * Math.cos(toRad(pos.lat)))) * (Math.random() < 0.5 ? -1 : 1) * Math.random();
  return { lat: pos.lat + dLat, lng: pos.lng + dLng };
}
function moveTowards(start, target, stepMeters) {
  const dist = haversine(start, target);
  if (dist <= stepMeters) return { ...target };
  const frac = stepMeters / Math.max(dist, 1);
  return { lat: start.lat + (target.lat - start.lat) * frac, lng: start.lng + (target.lng - start.lng) * frac };
}

// -------------------- Tracker Simulation -------------------- //
class Tracker {
  constructor(id, start, pathPlan) {
    this.id = id;
    this.pos = { ...start };
    this.prevPos = { ...start };
    this.path = pathPlan; // array of waypoints
    this.pathIndex = 0;
    this.status = 'online';
    this.lastUpdate = Date.now();
    this.idleStart = null;
    this.wasInsideOther = false;
    this.history = []; // { ts, status, detail }
    this.notifications = []; // strings of "time — text"
    this.events = []; // structured events
    this.pushEvent('online', 'Tracker came online');
  }

  pushEvent(type, message, extra={}) {
    const ts = Date.now();
    const entry = { tracker_id: this.id, type, message, tsISO: new Date(ts).toISOString(), ...extra };
    this.events.push(entry);
    this.history.push({ tsISO: entry.tsISO, status: type, detail: message });
    this.notifications.push(`${fmt(ts)} — [${this.id}] ${message}`);
  }

  simulateNetworkFlaps(tick) {
    // Simple pattern: every ~60-80 ticks, go offline for 2-3 ticks then reconnect
    if (tick % Math.floor(rnd(60, 80)) === 0) {
      this.status = 'offline';
      this.pushEvent('offline', 'Tracker went offline');
      this._offlineCounter = Math.floor(rnd(2, 4));
    }
    if (this.status === 'offline' && this._offlineCounter !== undefined) {
      this._offlineCounter -= 1;
      if (this._offlineCounter <= 1 && this._offlineCounter > 0) {
        this.pushEvent('reconnecting', 'Tracker reconnecting');
      }
      if (this._offlineCounter <= 0) {
        this.status = 'online';
        delete this._offlineCounter;
        this.pushEvent('online', 'Tracker back online');
      }
    }
  }

  updatePosition() {
    const target = this.path[this.pathIndex] || this.path[this.path.length - 1];
    const step = rnd(60, 120); // meters per tick
    const next = moveTowards(this.pos, target, step);
    // slight jitter
    this.prevPos = this.pos;
    this.pos = jitterMeters(next, 5);

    // reached waypoint? advance
    if (haversine(this.pos, target) < 50 && this.pathIndex < this.path.length - 1) {
      this.pathIndex += 1;
    }
  }

  computeHeading() {
    return Math.round(bearingFromTo(this.prevPos, this.pos));
  }

  detectGeofenceEvents() {
    const insideOther = inCircle(this.pos, GEOFENCE.other);
    if (insideOther && !this.wasInsideOther) {
      this.pushEvent('pass_through', 'Entered restricted area (other_boundary)', { geofence: 'other', direction: 'enter' });
      this.wasInsideOther = true;
      // reset idle tracking when entering
      this.idleStart = null;
    } else if (!insideOther && this.wasInsideOther) {
      this.pushEvent('pass_through', 'Exited restricted area (other_boundary)', { geofence: 'other', direction: 'exit' });
      this.wasInsideOther = false;
      this.idleStart = null;
    }
  }

  detectIdleOrViolation(now) {
    const moved = haversine(this.prevPos, this.pos);
    const insideOther = inCircle(this.pos, GEOFENCE.other);

    if (insideOther) {
      if (moved <= IDLE_DRIFT_M) {
        if (!this.idleStart) {
          this.idleStart = now;
          this.pushEvent('idle', `Idle detected in restricted area (≤${IDLE_DRIFT_M}m drift)`);
        } else {
          const dwell = now - this.idleStart;
          if (!this._violated && dwell >= IDLE_THRESHOLD_MS) {
            this._violated = true;
            const mins = Math.round(dwell / 60000);
            this.pushEvent('violation', `Violation: idle inside restricted area for ${mins} minute(s)`);
          }
        }
      } else {
        // movement resumed inside other
        if (this.idleStart) {
          this.pushEvent('pass_through', 'Movement resumed inside restricted area');
        }
        this.idleStart = null;
        this._violated = false;
      }
    } else {
      // outside restricted area → reset idle tracking
      this.idleStart = null;
      this._violated = false;
    }
  }

  tick(tickNo) {
    const now = Date.now();
    this.simulateNetworkFlaps(tickNo);

    // only produce GPS update if not offline
    if (this.status !== 'offline') {
      this.updatePosition();
      this.detectGeofenceEvents();
      this.detectIdleOrViolation(now);

      const heading = this.computeHeading();
      const update = {
        tracker_id: this.id,
        lat: this.pos.lat,
        lng: this.pos.lng,
        heading,
        timestamp: nowISO(),
        status: this.status,
      };
      this.events.push({ ...update, type: 'location_update' });

      // Optional: post to backend ingest to seed DB and trigger boundary logic
      if (SHOULD_POST && TOKENS[this.id]) {
        const body = { lat: update.lat, lng: update.lng, mfbr: MFBR[this.id] || undefined };
        const headers = { Authorization: `Token ${TOKENS[this.id]}` };
        postJSON(INGEST_URL, body, headers).then((res) => {
          if (res.status >= 400) {
            // best-effort logging only
            this.notifications.push(`${fmt(Date.now())} — [${this.id}] ingest failed ${res.status}`);
          }
        });
      }
    }
  }
}

// -------------------- Path Planning -------------------- //
// Tracker 1: San Fernando → cruises around → San Juan (to trigger idle/violation)
// Tracker 2: Stays mostly in San Fernando with occasional boundary pass-through
function buildPlans() {
  const sf = LOCATIONS.CityOfsanFernando;
  const sj = LOCATIONS.sanJuan;
  const aroundSF1 = [jitterMeters(sf, 800), jitterMeters(sf, 1200), jitterMeters(sf, 600)];
  const aroundSJ1 = [jitterMeters(sj, 500), jitterMeters(sj, 100)];

  const t1 = [sf, ...aroundSF1, sj, ...aroundSJ1];

  const aroundSF2 = [jitterMeters(sf, 300), jitterMeters(sf, 600), jitterMeters(sf, 300)];
  const nearSJExit = jitterMeters(sj, GEOFENCE.other.radiusM + 400); // skirt outside
  const t2 = [sf, ...aroundSF2, nearSJExit, jitterMeters(sf, 400), jitterMeters(sf, 700)];

  return { t1, t2 };
}

// -------------------- Runner -------------------- //
async function run() {
  const { t1, t2 } = buildPlans();
  const trackers = [
    new Tracker('TRK-001', LOCATIONS.CityOfsanFernando, t1),
    new Tracker('TRK-002', jitterMeters(LOCATIONS.CityOfsanFernando, 80), t2),
  ];

  const startTs = Date.now();
  const endTs = startTs + RUN_DURATION_SEC * 1000;
  let tick = 1;

  console.log(`[SIM] Starting two-tracker simulation. Test=${TEST_MODE} intervalMs=${INTERVAL_MS} durationSec=${RUN_DURATION_SEC}`);

  while (Date.now() < endTs) {
    trackers.forEach(t => t.tick(tick));
    await new Promise(r => setTimeout(r, INTERVAL_MS));
    tick += 1;
  }

  // Aggregate outputs
  const histories = Object.fromEntries(trackers.map(t => [t.id, t.history]));
  const notifications = trackers.flatMap(t => t.notifications);
  const events = trackers.flatMap(t => t.events);

  // CSV export for events (time,tracker_id,type,message,lat,lng,heading)
  const csvHeaders = ['timestamp','tracker_id','type','message','lat','lng','heading','status'];
  const csvRows = [csvHeaders.join(',')].concat(events.map(e => {
    const vals = [
      e.tsISO || e.timestamp || '',
      e.tracker_id || '',
      e.type || 'location_update',
      (e.message || '').replace(/[,\n]/g, ' '),
      e.lat != null ? e.lat.toFixed(6) : '',
      e.lng != null ? e.lng.toFixed(6) : '',
      e.heading != null ? e.heading : '',
      e.status || '',
    ];
    return vals.join(',');
  }));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = (name) => path.join(OUT_DIR, `${stamp}_${name}`);

  fs.writeFileSync(file('histories.json'), JSON.stringify(histories, null, 2));
  fs.writeFileSync(file('notifications.json'), JSON.stringify(notifications, null, 2));
  fs.writeFileSync(file('events.json'), JSON.stringify(events, null, 2));
  fs.writeFileSync(file('events.csv'), csvRows.join('\n'));

  // Summary
  const summary = trackers.map(t => ({
    tracker_id: t.id,
    total_events: t.events.length,
    violations: t.events.filter(e => e.type === 'violation').length,
    pass_through_enters: t.events.filter(e => e.type === 'pass_through' && e.direction === 'enter').length,
    pass_through_exits: t.events.filter(e => e.type === 'pass_through' && e.direction === 'exit').length,
    offline_count: t.events.filter(e => e.type === 'offline').length,
  }));
  fs.writeFileSync(file('summary.json'), JSON.stringify(summary, null, 2));

  console.log('[SIM] Done. Outputs written to scripts/output/');
}

run().catch(err => {
  console.error('[SIM] Error:', err);
  process.exit(1);
});
