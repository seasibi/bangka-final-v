import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../components/Tracker/BoatPopup.css";
import L from "leaflet";
import { apiClient } from "../services/api_urls";
import { getMunicipalities } from "../services/municipalityService";
import TrackerHistoryTimeline from "../components/Tracker/TrackerHistoryTimeline";
import ViolationToast from "../components/Notifications/ViolationToast";

// Enhanced GPS prediction and interpolation utilities
// Motion tracking calibration - can be overridden via localStorage('motionCalibration')
const defaultMotionCalibration = {
  // Speed thresholds in meters/second
  idleSpeedMps: 0.3,            // below = stationary
  normalSpeedMps: 3.0,          // typical small boat
  highSpeedMps: 10.0,           // fast travel
  // Duration scaling
  minDurationScale: 0.55,       // fastest animation = base * minScale
  maxDurationScale: 1.35,       // slowest animation = base * maxScale
  speedResponseSensitivity: 0.7, // how strongly speed affects duration (0..1)
  // Easing profile
  accelGammaMin: 0.65,          // gamma used for fastest speeds (early acceleration)
  accelGammaMax: 1.15,          // gamma used for slow speeds (gentler change)
  // Smoothing
  speedSmoothing: 0.25,         // EMA factor applied to instantaneous speed
};

const loadMotionCalibration = () => {
  try {
    const raw = window.localStorage.getItem('motionCalibration');
    if (!raw) return defaultMotionCalibration;
    const parsed = JSON.parse(raw);
    return { ...defaultMotionCalibration, ...(parsed || {}) };
  } catch (e) {
    return defaultMotionCalibration;
  }
};

// Global animation speed multiplier (lower = faster). Override via localStorage('markerAnimSpeed')
const getAnimSpeedMultiplier = () => {
  try {
    const raw = window.localStorage.getItem('markerAnimSpeed');
    const v = parseFloat(raw);
    return Number.isFinite(v) && v > 0 ? v : 0.7; // default 0.7 => ~30% faster
  } catch {
    return 0.7;
  }
};
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - 
           Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const calculateSpeed = (lat1, lon1, lat2, lon2, timeDiffMs) => {
  if (timeDiffMs <= 0) return 0;
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance / (timeDiffMs / 1000); // meters per second
};

const predictPosition = (currentPos, previousPos, timeDiffMs, predictionTimeMs) => {
  if (!previousPos || timeDiffMs <= 0 || predictionTimeMs <= 0) {
    return currentPos;
  }

  const speed = calculateSpeed(
    previousPos.lat, previousPos.lng,
    currentPos.lat, currentPos.lng,
    timeDiffMs
  );

  // Don't predict if speed is too low (stationary) or too high (GPS error)
  if (speed < 0.5 || speed > 50) { // 0.5 m/s minimum, 50 m/s maximum (180 km/h)
    return currentPos;
  }

  const bearing = calculateBearing(
    previousPos.lat, previousPos.lng,
    currentPos.lat, currentPos.lng
  );

  // Calculate predicted distance
  const predictionDistance = speed * (predictionTimeMs / 1000);

  // Convert bearing to radians
  const bearingRad = (bearing * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters

  // Current position in radians
  const lat1 = (currentPos.lat * Math.PI) / 180;
  const lon1 = (currentPos.lng * Math.PI) / 180;

  // Calculate new position
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(predictionDistance / R) +
    Math.cos(lat1) * Math.sin(predictionDistance / R) * Math.cos(bearingRad)
  );

  const lon2 = lon1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(predictionDistance / R) * Math.cos(lat1),
    Math.cos(predictionDistance / R) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
};

const interpolatePosition = (from, to, progress) => {
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress
  };
};

// Parametric S-curve easing that supports acceleration bias via gamma
// gamma < 1 → quicker acceleration; gamma > 1 → gentler acceleration
const sCurve = (t, gamma = 1.0) => {
  const clamped = Math.max(0, Math.min(1, t));
  const a = Math.pow(clamped, gamma);
  const b = Math.pow(1 - clamped, gamma);
  return a / (a + b);
};

// Ultra-smooth interpolation hook with prediction
const useUltraSmoothInterpolation = (targetPosition, previousPosition, lastUpdateTime, duration = 3000, easingGamma = 1.0) => {
  const [currentPosition, setCurrentPosition] = useState(targetPosition);
  const animationRef = useRef();
  const startTimeRef = useRef();
  const startPositionRef = useRef(targetPosition);
  const predictionRef = useRef(null);

  useEffect(() => {
    if (!targetPosition) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - (lastUpdateTime || now);
    
    // Predict where the boat should be now based on movement pattern
    let predictedCurrentPosition = targetPosition;
    if (previousPosition && timeSinceLastUpdate > 0) {
      const timeDiffBetweenPoints = timeSinceLastUpdate;
      predictedCurrentPosition = predictPosition(
        targetPosition, 
        previousPosition, 
        timeDiffBetweenPoints, 
        Math.min(timeSinceLastUpdate, 8000) // Don't predict more than 8 seconds
      );
      predictionRef.current = predictedCurrentPosition;
    }

    const startPosition = currentPosition;
    const startTime = now;
    startTimeRef.current = startTime;
    startPositionRef.current = startPosition;

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Dynamic S-curve easing (speed-aware via gamma)
      const easedProgress = sCurve(progress, easingGamma);

      let interpolatedPosition;
      
      // If we have a prediction, interpolate towards the predicted position first,
      // then towards the target
      if (predictionRef.current && progress < 0.7) {
        const predictionProgress = Math.min(progress / 0.7, 1);
        interpolatedPosition = interpolatePosition(startPosition, predictionRef.current, predictionProgress * easedProgress);
      } else {
        // After 70% of animation, move towards actual target
        const targetProgress = predictionRef.current ? (progress - 0.7) / 0.3 : progress;
        const basePosition = predictionRef.current || startPosition;
        interpolatedPosition = interpolatePosition(basePosition, predictedCurrentPosition, targetProgress * easedProgress);
      }

      setCurrentPosition(interpolatedPosition);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetPosition?.lat, targetPosition?.lng, duration, currentPosition, previousPosition, lastUpdateTime, easingGamma]);

  return currentPosition;
};

// Enhanced Boat Marker Component with ultra-smooth movement and prediction
const UltraSmoothBoatMarker = ({ feature, previousFeature, getBoatColor, createBoatIcon, isViolating, onViewHistory }) => {
  // GeoJSON stores coordinates as [lng, lat]
  const coords = feature?.geometry?.coordinates || [];
  const [lng, lat] = coords;
  const hasValid = Number.isFinite(lat) && Number.isFinite(lng);
  const targetPosition = hasValid ? { lat, lng } : { lat: 0, lng: 0 };
  const markerRef = useRef(null);
  
  // Get previous position for prediction
  let previousPosition = null;
  if (previousFeature && Array.isArray(previousFeature?.geometry?.coordinates)) {
    const [prevLng, prevLat] = previousFeature.geometry.coordinates;
    if (Number.isFinite(prevLat) && Number.isFinite(prevLng)) {
      previousPosition = { lat: prevLat, lng: prevLng };
    }
  }

  const lastUpdateTime = new Date(feature.properties.timestamp).getTime();
  // Compute dynamic animation duration based on interval and speed with calibration
  const motionCfg = useMemo(() => loadMotionCalibration(), []);
  let baseDuration = 1000; // ms baseline (faster default)
  let computedSpeed = 0;   // m/s
  if (previousFeature && previousFeature.properties?.timestamp) {
    const prevTs = new Date(previousFeature.properties.timestamp).getTime();
    const intervalMs = Math.max(0, lastUpdateTime - prevTs);
    // Faster baseline mapping: ~0.10x of posting interval, clamped to [500..1200]ms
    baseDuration = Math.max(500, Math.min(1200, Math.floor(intervalMs * 0.10)));
    if (previousPosition) {
      computedSpeed = calculateSpeed(
        previousPosition.lat, previousPosition.lng,
        targetPosition.lat, targetPosition.lng,
        intervalMs
      );
    }
  }
  // Smooth the instantaneous speed via EMA to avoid abrupt changes
  const smoothedSpeedRef = useRef(0);
  const smoothing = Math.max(0, Math.min(1, motionCfg.speedSmoothing));
  if (computedSpeed > 0) {
    smoothedSpeedRef.current = smoothedSpeedRef.current * (1 - smoothing) + computedSpeed * smoothing;
  }
  const speedMps = smoothedSpeedRef.current || computedSpeed || 0;

  // Normalize speed to 0..1 using thresholds
  const idle = motionCfg.idleSpeedMps;
  const high = motionCfg.highSpeedMps;
  const speedRatio = Math.max(0, Math.min(1, (speedMps - idle) / Math.max(0.001, high - idle)));

  // Duration scaling based on speed (reduce duration for higher speed)
  const sens = Math.max(0, Math.min(1, motionCfg.speedResponseSensitivity));
  const minScale = Math.max(0.3, motionCfg.minDurationScale);
  const maxScale = Math.max(minScale, motionCfg.maxDurationScale);
  const durationScale = Math.max(minScale, Math.min(maxScale, 1 - sens * (speedRatio - 0.5) * 2));
  const animMultiplier = getAnimSpeedMultiplier(); // e.g., 0.7 = faster
  const effectiveDuration = Math.max(
    350,
    Math.min(1200, Math.floor(baseDuration * durationScale * animMultiplier))
  );

  // Easing gamma: smaller for higher speeds (earlier acceleration)
  const gMin = Math.max(0.3, motionCfg.accelGammaMin);
  const gMax = Math.max(gMin, motionCfg.accelGammaMax);
  const easingGamma = gMax - (gMax - gMin) * speedRatio;

  const currentPosition = useUltraSmoothInterpolation(
    targetPosition,
    previousPosition,
    lastUpdateTime,
    effectiveDuration,
    easingGamma
  );
  
  if (!hasValid) {
    console.warn('Skipping marker with invalid coordinates', coords, feature?.properties);
    return null;
  }
  
  const { boat_id, mfbr_number, boat_name, latitude, longitude, status, identifier_icon, tracker_id } = feature.properties;

  // ALWAYS use backend-provided marker_color (backend determines color based on current location)
  // This ensures identifier color matches the municipality the boat is currently in
  let color = feature?.properties?.marker_color;
  
  // Fallback to municipality lookup ONLY if backend didn't provide color
  if (!color) {
    color = getBoatColor(mfbr_number || boat_id);
  }
  
  // Override with red if boat is violating boundary
  if (isViolating) {
    color = "#dc2626";
  }
  
  // Use identifier_icon from feature properties, default to 'boat' for backwards compatibility
  const iconType = identifier_icon || 'boat';
  const icon = createBoatIcon(color, status, isViolating, iconType);

  // Prepare display coordinates (fallback to geometry if properties missing)
  const displayLon = Number.isFinite(Number(longitude))
    ? Number(longitude).toFixed(6)
    : (typeof feature.geometry.coordinates?.[0] === 'number' ? feature.geometry.coordinates[0].toFixed(6) : String(feature.geometry.coordinates?.[0] ?? ''));
  const displayLat = Number.isFinite(Number(latitude))
    ? Number(latitude).toFixed(6)
    : (typeof feature.geometry.coordinates?.[1] === 'number' ? feature.geometry.coordinates[1].toFixed(6) : String(feature.geometry.coordinates?.[1] ?? ''));

  // Robust MFBR display: show Unknown when missing/0/empty
  const displayMfbr = mfbr_number 
    ? mfbr_number
    : ((boat_id && String(boat_id).trim() && String(boat_id) !== '0') ? boat_id : 'Unknown');

  // Create enhanced tooltip content for hover with complete boat details
  const tooltipContent = `
    <div style="font-family: 'Montserrat', sans-serif; font-size: 11px; padding: 8px; min-width: 220px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 2px;">
          ${boat_name || 'Unknown Boat'}
        </div>
        <div style="font-size: 10px; color: #64748b; font-weight: 600;">
          MFBR: ${displayMfbr}
        </div>
      </div>
      
      <div style="display: grid; gap: 4px; margin-bottom: 6px;">
        ${tracker_id ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #64748b; font-size: 10px;">Tracker ID:</span>
            <span style="color: #1e293b; font-weight: 600; font-family: 'Courier New', monospace; font-size: 10px;">${tracker_id}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #64748b; font-size: 10px;">Latitude:</span>
          <span style="color: #1e293b; font-weight: 600; font-family: 'Courier New', monospace; font-size: 10px;">${displayLat}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #64748b; font-size: 10px;">Longitude:</span>
          <span style="color: #1e293b; font-weight: 600; font-family: 'Courier New', monospace; font-size: 10px;">${displayLon}</span>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid #e2e8f0;">
        <span style="font-size: 10px; font-weight: 600; color: ${
          isViolating ? '#dc2626' : 
          status === 'offline' || (feature.properties.age_seconds || 0) > OFFLINE_THRESHOLD_SECONDS ? '#6b7280' : '#16a34a'
        }; display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 14px;">${
            isViolating ? '🚨' : 
            status === 'offline' || (feature.properties.age_seconds || 0) > OFFLINE_THRESHOLD_SECONDS ? '⚫' : '🟢'
          }</span>
          ${
            isViolating ? 'VIOLATION' : 
            status === 'offline' || (feature.properties.age_seconds || 0) > OFFLINE_THRESHOLD_SECONDS ? 'Offline' : 'Online'
          }
        </span>
        <span style="font-size: 9px; color: #94a3b8; font-style: italic;">Click for history</span>
      </div>
    </div>
  `;

  const handleClick = () => {
    if (!onViewHistory) {
      alert('ERROR: onViewHistory not defined');
      return;
    }
    
    const tid = tracker_id || feature?.properties?.BirukBilugID || feature?.properties?.tracker || displayMfbr || boat_id;
    const boatData = {
      mfbr_number: displayMfbr,
      boat_name: boat_name || 'Unknown Boat',
      current_lat: Number(currentPosition.lat),
      current_lng: Number(currentPosition.lng),
    };
    
    onViewHistory(String(tid || ''), boatData);
  };
  
  // Defensive: ensure underlying Leaflet marker DOM also triggers the handler
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const inst = marker?.leafletElement || marker?._leaflet_id ? marker : marker;
    try {
      // react-leaflet v4 exposes markerRef.current as the Marker instance
      inst?.on?.('click', handleClick);
      inst?.on?.('mousedown', handleClick);
      inst?.on?.('touchstart', handleClick);
    } catch (e) {
      // no-op
    }
    return () => {
      try {
        inst?.off?.('click', handleClick);
        inst?.off?.('mousedown', handleClick);
        inst?.off?.('touchstart', handleClick);
      } catch (e) {
        // no-op
      }
    };
  }, [markerRef, currentPosition?.lat, currentPosition?.lng, tracker_id]);

  return (
    <Marker 
      position={[currentPosition.lat, currentPosition.lng]} 
      icon={icon}
      zIndexOffset={isViolating ? 2000 : 1000}
      ref={markerRef}
      riseOnHover={true}
      bubblingMouseEvents={true}
      keyboard={true}
      eventHandlers={{
        click: handleClick,
        mousedown: handleClick,
        touchstart: handleClick
      }}
    >
      <Tooltip 
        direction="top" 
        offset={[0, -10]} 
        opacity={0.95}
        permanent={false}
        interactive={true}
        eventHandlers={{
          click: handleClick,
          mousedown: handleClick,
          touchstart: handleClick
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: tooltipContent }} />
      </Tooltip>
    </Marker>
  );
};

// Enhanced WebSocket Hook for Real-time GPS Updates with boundary notifications and multiple device support
const useWebSocketGPS = (onBoundaryNotification, onViolationCleared) => {
  const [gpsData, setGpsData] = useState(() => {
    // Initialize from localStorage to persist trackers across refreshes
    try {
      const cached = localStorage.getItem('bangka_gps_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is less than 5 minutes old
        if (parsed.timestamp && (Date.now() - parsed.timestamp < 300000)) {
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('Failed to load GPS cache:', e);
    }
    return null;
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  
  // Store callbacks in refs to avoid reconnection on callback changes
  const onBoundaryNotificationRef = useRef(onBoundaryNotification);
  const onViolationClearedRef = useRef(onViolationCleared);
  
  useEffect(() => {
    onBoundaryNotificationRef.current = onBoundaryNotification;
    onViolationClearedRef.current = onViolationCleared;
  }, [onBoundaryNotification, onViolationCleared]);

  // Save GPS data to localStorage whenever it updates
  useEffect(() => {
    if (gpsData) {
      try {
        localStorage.setItem('bangka_gps_cache', JSON.stringify({
          timestamp: Date.now(),
          data: gpsData
        }));
      } catch (e) {
        console.warn('Failed to cache GPS data:', e);
      }
    }
  }, [gpsData]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_HOST || 'localhost';
    const wsPort = import.meta.env.VITE_WS_PORT || '8000';
    const wsUrl = `${protocol}//${wsHost}:${wsPort}/ws/gps/`;
    
    const connectWebSocket = () => {
      // Prevent duplicate connections
      if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }
      
      try {
        isConnectingRef.current = true;
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('[WebSocket] Connected for GPS updates');
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          isConnectingRef.current = false;
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'gps_update' || message.type === 'initial_data') {
              // Merge new data with existing to maintain all devices
              setGpsData(prevData => {
                if (!message.data?.features) return message.data;
                
                // Create map of existing features by unique ID
                const existingMap = new Map();
                if (prevData?.features) {
                  prevData.features.forEach(feat => {
                    const id = feat?.properties?.tracker_id || 
                               feat?.properties?.mfbr_number || 
                               feat?.properties?.boat_id;
                    if (id) existingMap.set(id, feat);
                  });
                }
                
                // Update with new features
                message.data.features.forEach(feat => {
                  const id = feat?.properties?.tracker_id || 
                            feat?.properties?.mfbr_number || 
                            feat?.properties?.boat_id;
                  if (id) existingMap.set(id, feat);
                });
                
                return {
                  type: "FeatureCollection",
                  features: Array.from(existingMap.values())
                };
              });
            } else if (message.type === 'boundary_notification' && onBoundaryNotificationRef.current) {
              // Handle boundary violation notification with proper timestamps
              const violationData = message.data;
              const now = new Date();
              const violationTimestamp = violationData.violation_timestamp || now.toISOString();
              const dwellMinutes = Math.floor((violationData.dwell_duration || 900) / 60);
              const timestampStart = new Date(new Date(violationTimestamp).getTime() - (dwellMinutes * 60000)).toISOString();
              
              const enhancedData = {
                ...violationData,
                boat_id: violationData.boat_name || violationData.mfbr_number,
                owner_name: violationData.fisherfolk_name || violationData.owner_name || 'Unknown',
                registration_number: violationData.mfbr_number || 'Unknown',
                timestamp: violationTimestamp,
                timestamp_start: timestampStart,
                timestamp_end: violationTimestamp,
                idle_minutes: dwellMinutes,
                location: {
                  lat: violationData.current_lat,
                  lng: violationData.current_lng
                },
                municipality: violationData.to_municipality,
                own_municipality: violationData.from_municipality
              };
              
              console.log('Boundary violation detected with enhanced data:', enhancedData);
              onBoundaryNotificationRef.current(enhancedData);
            } else if (message.type === 'violation_cleared' && onViolationClearedRef.current) {
              console.log('Violation cleared:', message.data);
              onViolationClearedRef.current(message.data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        wsRef.current.onclose = (event) => {
          isConnectingRef.current = false;
          // Only log if it's not a normal closure
          if (event.code !== 1000 && event.code !== 1006) {
            console.log('[WebSocket] Disconnected:', event.code, event.reason);
          }
          setConnectionStatus('disconnected');
          
          // Exponential backoff reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (document.visibilityState === 'visible' && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
              connectWebSocket();
            }
          }, delay);
        };

        wsRef.current.onerror = (error) => {
          isConnectingRef.current = false;
          setConnectionStatus('error');
        };

      } catch (error) {
        // WebSocket connection failed - using HTTP polling fallback
        isConnectingRef.current = false;
        setConnectionStatus('error');
      }
    };

    // Handle visibility change to optimize WebSocket connection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          wsRef.current?.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connectWebSocket();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Empty deps - callbacks are in refs

  return { gpsData, connectionStatus };
};

const DEAD_BAND_METERS = 7;
const OFFLINE_THRESHOLD_SECONDS = 480; // 8 minutes - boat is offline if no GPS data for 8+ minutes

const MapView = ({ boundaryType = "both", searchMfbr = "" }) => {
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [smoothFeatures, setSmoothFeatures] = useState([]);
  const [previousFeatures, setPreviousFeatures] = useState(new Map()); // Store previous positions for prediction
  const [landBoundaries, setLandBoundaries] = useState(null);
  const [waterBoundaries, setWaterBoundaries] = useState(null);
  const [violatingBoats, setViolatingBoats] = useState(new Set()); // Track boats with violations
  const [showHistoryTimeline, setShowHistoryTimeline] = useState(false);
  const [selectedTrackerData, setSelectedTrackerData] = useState(null);
  const [violationNotification, setViolationNotification] = useState(null); // For toast display
  const [isLegendExpanded, setIsLegendExpanded] = useState(true); // Legend visibility state
  
  // Handle view history click
  const handleViewHistory = (trackerId, boatData) => {
    setSelectedTrackerData({ trackerId, boatData });
    setShowHistoryTimeline(true);
  };
  
  // Handle boundary violation notifications and show toast
  const handleBoundaryNotification = (notificationData) => {
    const boatId = notificationData.mfbr_number || notificationData.boat_name;
    if (boatId) {
      setViolatingBoats(prev => new Set([...prev, boatId]));
      // Set the notification to display the toast
      setViolationNotification(notificationData);
    }
    console.log('Boundary violation detected:', notificationData);
  };

  // Use WebSocket for real-time updates
  const { gpsData, connectionStatus } = useWebSocketGPS(handleBoundaryNotification, (data) => {
    const id1 = data?.mfbr_number ? String(data.mfbr_number) : null;
    const id2 = data?.boat_id != null ? String(data.boat_id) : null;
    setViolatingBoats(prev => {
      const next = new Set(prev);
      if (id1) next.delete(id1);
      if (id2) next.delete(id2);
      return next;
    });
  });

  // Dynamic municipality colors from database
  const [municipalityColors, setMunicipalityColors] = useState({
    // Fallback hardcoded colors
    "San Fernando": "",
    "City Of San Fernando": "",
    Agoo: "#3b82f6",
    Aringay: "#ef4444",
    Bacnotan: "#f59e0b",
    Bagulin: "#8b5cf6",
    Balaoan: "#ec4899",
    Bangar: "#14b8a6",
    Bauang: "#f97316",
    Burgos: "#a855f7",
    Caba: "#06b6d4",
    Luna: "#84cc16",
    Naguilian: "#eab308",
    Pugo: "#10b981",
    Rosario: "#6366f1",
    "San Gabriel": "#d946ef",
    "San Juan": "#06b6d4",
    Santol: "#f43f5e",
    "Santo Tomas": "#0ea5e9",
    "Sto. Tomas": "#0ea5e9",
    Sudipen: "#64748b",
    Tubao: "#737373",
  });

  // Fetch municipality colors from API
  useEffect(() => {
    const fetchMunicipalityColors = async () => {
      try {
        const municipalities = await getMunicipalities();
        const colorMap = {};
        municipalities.forEach(muni => {
          colorMap[muni.name] = muni.color;
          // Add aliases
          if (muni.name === 'San Fernando') {
            colorMap['City Of San Fernando'] = muni.color;
          }
          if (muni.name === 'Santo Tomas') {
            colorMap['Sto. Tomas'] = muni.color;
          }
        });
        console.log('Loaded municipality colors from database:', colorMap);
        setMunicipalityColors(prevColors => ({ ...prevColors, ...colorMap }));
      } catch (error) {
        console.error('Failed to load municipality colors, using defaults:', error);
      }
    };
    fetchMunicipalityColors();
  }, []);

  // Canonical display order
  const municipalityOrder = [
    "Agoo","Aringay","Bacnotan","Bagulin","Balaoan","Bangar","Bauang","Burgos","Caba",
    "City Of San Fernando","Luna","Naguilian","Pugo","Rosario","San Gabriel","San Juan",
    "Santo Tomas","Santol","Sudipen","Tubao"
  ];

  // ...existing code...

  // ...existing code...

  // Helper to normalize municipality aliases
  const normalizeMuni = (name) => {
    if (!name) return name;
    if (name === 'San Fernando') return 'City Of San Fernando';
    if (name === 'Sto. Tomas') return 'Santo Tomas';
    return name;
  };

  // Build boat_id -> municipality map
  const [boatMunicipalityMap, setBoatMunicipalityMap] = useState(new Map());
  useEffect(() => {
    const loadBoats = async () => {
      try {
        const res = await apiClient.get('boats/');
        const map = new Map();
        (res.data || []).forEach(b => {
          const id = b.boat_id ?? b.id;
          const muni = b.municipality || b?.fisherfolk?.address?.municipality || b?.fisherfolk?.municipality || null;
          if (id != null && muni) {
            map.set(String(id), muni);
            if (b.mfbr_number) map.set(String(b.mfbr_number), muni);
          }
        });
        setBoatMunicipalityMap(map);
      } catch (e) {
        console.warn('Could not load boats for municipality colors', e?.response?.status || e);
      }
    };
    loadBoats();
  }, []);

  // Fetch boundaries once on mount
  useEffect(() => {
    const fetchBoundaries = async () => {
      // Normalization function for geometry

        const normalizeGeometry = (coords) => {
          if (!coords) return null;
          
          // Already GeoJSON format
          if (coords.type && coords.coordinates) return coords;
          
          // Raw array of coordinates
          if (Array.isArray(coords)) {
            // Check structure depth
            if (coords.length > 0 && Array.isArray(coords[0])) {
              // coords[0] is an array
              if (coords[0].length > 0 && Array.isArray(coords[0][0])) {
                // coords[0][0] is an array
                if (typeof coords[0][0][0] === "number") {
                  // Structure: [[[lng,lat], ...]] - already has ring wrapper
                  return { type: "Polygon", coordinates: coords };
                }
              } else if (typeof coords[0][0] === "number") {
                // Structure: [[lng,lat], [lng,lat], ...] - needs ring wrapper
                return { type: "Polygon", coordinates: [coords] };
              }
            }
          }
          
          console.warn('[NORMALIZE] Unknown coordinate structure:', coords);
          return null;
        };

        const findFirstNumericLngLat = (geom) => {
          if (!geom || !geom.coordinates) return null;
          const walk = (node) => {
            if (!node) return null;
            if (Array.isArray(node) && node.length >= 2 && Number.isFinite(node[0]) && Number.isFinite(node[1])) {
              return node;
            }
            if (Array.isArray(node)) {
              for (const child of node) {
                const found = walk(child);
                if (found) return found;
              }
            }
            return null;
          };
          return walk(geom.coordinates);
        };

        const isLngLat = (p) => {
          if (!Array.isArray(p) || p.length < 2) return false;
          const [lng, lat] = p;
          // Check both are finite numbers and in valid ranges
          return Number.isFinite(lng) && Number.isFinite(lat) && 
                 lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        };

        const sanitizeGeometry = (geom, municipalityName) => {
          if (!geom || !geom.coordinates) {
            console.warn(`[SANITIZE] ${municipalityName || 'unknown'} - no geometry/coordinates`);
            return null;
          }
          const type = geom.type;
          try {
            if (type === 'Polygon') {
              const cleanedRings = (geom.coordinates || []).map((ring, ringIdx) => {
                // Filter out invalid points
                const validPts = (ring || []).filter(isLngLat);
                
                // Need at least 3 unique points
                if (validPts.length < 3) {
                  console.warn(`[SANITIZE] ${municipalityName} ring ${ringIdx} - only ${validPts.length} valid points (need 3+)`);
                  return null;
                }
                
                // Create a new clean array to avoid mutation issues
                const cleanRing = validPts.map(pt => [pt[0], pt[1]]);
                
                // Close ring if needed
                const first = cleanRing[0];
                const last = cleanRing[cleanRing.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                  cleanRing.push([first[0], first[1]]);
                }
                
                // Final validation - ensure all points are still valid
                const allValid = cleanRing.every(pt => 
                  Array.isArray(pt) && pt.length === 2 && 
                  Number.isFinite(pt[0]) && Number.isFinite(pt[1])
                );
                
                if (!allValid) {
                  console.warn(`[SANITIZE] ${municipalityName} ring ${ringIdx} - has invalid points after closing`);
                  return null;
                }
                
                return cleanRing;
              }).filter(Boolean);
              
              if (cleanedRings.length === 0) {
                console.warn(`[SANITIZE] ${municipalityName} - no valid rings after cleaning`);
                return null;
              }
              return { type: 'Polygon', coordinates: cleanedRings };
            } else if (type === 'MultiPolygon') {
              const cleanedPolys = (geom.coordinates || []).map((poly, polyIdx) => {
                const cleanedRings = (poly || []).map((ring, ringIdx) => {
                  const validPts = (ring || []).filter(isLngLat);
                  if (validPts.length < 3) {
                    console.warn(`[SANITIZE] ${municipalityName} poly ${polyIdx} ring ${ringIdx} - only ${validPts.length} valid points`);
                    return null;
                  }
                  
                  // Create clean array
                  const cleanRing = validPts.map(pt => [pt[0], pt[1]]);
                  
                  // Close ring
                  const first = cleanRing[0];
                  const last = cleanRing[cleanRing.length - 1];
                  if (first[0] !== last[0] || first[1] !== last[1]) {
                    cleanRing.push([first[0], first[1]]);
                  }
                  
                  // Validate
                  const allValid = cleanRing.every(pt => 
                    Array.isArray(pt) && pt.length === 2 && 
                    Number.isFinite(pt[0]) && Number.isFinite(pt[1])
                  );
                  
                  if (!allValid) {
                    console.warn(`[SANITIZE] ${municipalityName} poly ${polyIdx} ring ${ringIdx} - invalid after closing`);
                    return null;
                  }
                  
                  return cleanRing;
                }).filter(Boolean);
                return cleanedRings.length > 0 ? cleanedRings : null;
              }).filter(Boolean);
              if (cleanedPolys.length === 0) {
                console.warn(`[SANITIZE] ${municipalityName} - no valid polygons after cleaning`);
                return null;
              }
              return { type: 'MultiPolygon', coordinates: cleanedPolys };
            }
            console.warn(`[SANITIZE] ${municipalityName} - unknown geometry type: ${type}`);
            return null;
          } catch (e) {
            console.warn(`[SANITIZE] ${municipalityName} - exception:`, e);
            return null;
          }
        };
        try {
        // Fetch land boundaries
        const landRes = await apiClient.get("land-boundaries/");
        const landData = landRes.data || [];
        console.log(`[BOUNDARIES] Loaded ${landData.length} land boundaries from backend`);
        
        const landFeatures = landData.map((item) => {
          const geom = normalizeGeometry(item.coordinates);
          // Validate geometry quickly by checking first numeric coordinate
          let valid = false;
          const c = findFirstNumericLngLat(geom);
          if (c) valid = true;
          if (!valid) {
            console.warn(`[BOUNDARIES] Skipping ${item.name} - no valid coordinates found`);
            return null;
          }
          
          // Log structure before sanitation for problematic municipalities
          const problematicMunis = ['San Gabriel', 'San Juan', 'Santol', 'Burgos'];
          if (problematicMunis.includes(item.name)) {
            console.log(`[DEBUG] ${item.name} BEFORE sanitize:`);
            console.log(`  - Geom type: ${geom?.type}`);
            console.log(`  - Has coordinates: ${!!geom?.coordinates}`);
            if (geom?.coordinates) {
              console.log(`  - Coordinates depth: ${Array.isArray(geom.coordinates) ? geom.coordinates.length : 'not array'}`);
              if (Array.isArray(geom.coordinates) && geom.coordinates[0]) {
                console.log(`  - First ring length: ${Array.isArray(geom.coordinates[0]) ? geom.coordinates[0].length : 'not array'}`);
                console.log(`  - First point:`, geom.coordinates[0][0]);
              }
            }
          }
          
          // Sanitize geometry to ensure valid coordinates
          const sanitized = sanitizeGeometry(geom, item.name);
          
          if (!sanitized || !sanitized.coordinates) {
            console.warn(`[BOUNDARIES] Skipping ${item.name} - sanitization failed`);
            return null;
          }
          
          // Debug San Fernando and San Gabriel specifically
          if (item.name === 'City Of San Fernando' || item.name === 'San Gabriel') {
            console.log(`[BOUNDARIES] ✅ ${item.name} validated successfully`);
            console.log(`  - Vertices: ${geom.coordinates?.[0]?.length || 'unknown'}`);
            console.log(`  - First coord:`, c);
          }
          
          return {
            type: "Feature",
            properties: {
              name: item.name,
              landArea: item.land_area,
              boundaryLength: item.boundary_length,
            },
            geometry: sanitized,
          };
        }).filter(Boolean);
        
        console.log(`[BOUNDARIES] Rendering ${landFeatures.length} land boundaries`);
        const names = landFeatures.map(f => f.properties.name).sort();
        console.log('[BOUNDARIES] Available:', names.join(', '));
        
        setLandBoundaries({
          type: "FeatureCollection",
          features: landFeatures,
        });
      } catch (err) {
        console.error("Failed to fetch land boundaries", err);
      }
        

    try {
        // Fetch water boundaries
        const waterRes = await apiClient.get("boundaries/");
        const waterData = waterRes.data || [];
        const waterFeatures = waterData.map((item) => {
          const geom = normalizeGeometry(item.coordinates);
          let valid = false;
          const c = findFirstNumericLngLat(geom);
          if (c) valid = true;
          if (!valid) return null;
          const sanitized = sanitizeGeometry(geom);
          if (!sanitized) return null;
          return {
            type: "Feature",
            properties: {
              name: item.name,
              waterArea: item.water_area,
              coastlineLength: item.coastline_length,
              isWater: true,
            },
            geometry: sanitized,
          };
        }).filter(Boolean);
        setWaterBoundaries({
          type: "FeatureCollection",
          features: waterFeatures,
        });
        console.log("Sample water feature:", waterFeatures[0]);
      } catch (err) {
        console.error("Failed to fetch water boundaries", err);
      }
    };

    fetchBoundaries();
  }, []);

// State to track device token statuses for filtering lost devices
  const [deviceTokens, setDeviceTokens] = useState(new Map());
  
  // Fetch device token statuses to filter lost devices
  useEffect(() => {
    const fetchTokenStatuses = async () => {
      try {
        const response = await apiClient.get('device-tokens/');
        const tokens = response.data || [];
        const tokenMap = new Map();
        tokens.forEach(token => {
          if (token.name) {
            tokenMap.set(token.name, token);
          }
        });
        setDeviceTokens(tokenMap);
      } catch (error) {
        console.error('Failed to fetch device token statuses:', error);
      }
    };
    
    fetchTokenStatuses();
    // Refresh token statuses every 5 minutes (reduced from 30s to minimize server load)
    const interval = setInterval(fetchTokenStatuses, 300000);
    return () => clearInterval(interval);
  }, []);

  // Process GPS data from WebSocket with deadband filtering, prediction, and lost device filtering
  useEffect(() => {
    if (!gpsData?.features) return;

    const latest = new Map();
    gpsData.features.forEach(feat => {
      const id = feat?.properties?.mfbr_number || feat?.properties?.boat_id || 0;
      const trackerId = feat?.properties?.tracker_id || feat?.properties?.BirukBilugID;
      
      // ONLY filter out LOST devices (devices marked as is_active=false in device-tokens)
      // DO NOT filter out offline trackers - they should remain visible on the map
      if (trackerId && deviceTokens.has(trackerId)) {
        const token = deviceTokens.get(trackerId);
        if (token.is_active === false) {
          console.log(`[MAP] Filtering out LOST device (is_active=false): ${trackerId}`);
          return; // Skip this feature - device is lost/deactivated
        }
      }
      
      // Keep all other trackers (including offline ones) - they will be styled accordingly
      if (!latest.has(id)) latest.set(id, feat);
    });

    const applyComputedStatus = (feature) => {
      const timestamp = feature?.properties?.timestamp || '';
      const ts = Date.parse(timestamp);
      const age = Number.isFinite(ts) ? Math.floor((Date.now() - ts) / 1000) : null;
      
      // CRITICAL FIX: Use backend's status if provided (from TrackerStatusEvent)
      // Only fallback to age-based calculation if backend doesn't provide status
      const backendStatus = feature?.properties?.status;
      const computedStatus = age != null && age > OFFLINE_THRESHOLD_SECONDS ? 'offline' : 'online';
      const finalStatus = backendStatus || computedStatus;
      
      return {
        ...feature,
        properties: { ...feature.properties, status: finalStatus, age_seconds: age },
      };
    };

    setSmoothFeatures((prev) => {
      const prevMap = new Map(
        (prev || []).map((f) => [f?.properties?.boat_id, f])
      );
      
      // Track which boat IDs are in the new data
      const activeBoatIds = new Set(latest.keys());
      
      const next = [];
      
      for (const [id, feat] of latest.entries()) {
        const [lng, lat] = feat.geometry.coordinates || [0, 0];
        const prevFeat = prevMap.get(id);
        
        if (prevFeat) {
          const [plng, plat] = prevFeat.geometry.coordinates || [0, 0];
          const distance = calculateDistance(plat, plng, lat, lng);
          
          if (isFinite(distance) && distance < DEAD_BAND_METERS) {
            // Keep previous geometry; update properties from latest
            const merged = { ...prevFeat, properties: { ...prevFeat.properties, ...feat.properties } };
            next.push(applyComputedStatus(merged));
            continue;
          }
          
          // Store previous position for prediction
          setPreviousFeatures(prevFeatures => {
            const newPrevFeatures = new Map(prevFeatures);
            newPrevFeatures.set(id, prevFeat);
            return newPrevFeatures;
          });
        }
        
        // Accept new point
        next.push(applyComputedStatus(feat));
      }
      
      // PRESERVE OFFLINE TRACKERS: Keep previous trackers that aren't in the new data
      // This ensures offline trackers remain visible on the map
      prevMap.forEach((prevFeat, prevId) => {
        if (!activeBoatIds.has(prevId)) {
          // This tracker isn't in the latest update - it's offline
          // Keep it visible with its last known position and offline status
          next.push(applyComputedStatus(prevFeat));
        }
      });
      
      console.log(`[MAP] Active boats: ${activeBoatIds.size}, Total rendered markers (including offline): ${next.length}`);
      return next;
    });
  }, [gpsData]);

  // Fallback polling (same as before)
  useEffect(() => {
    if (connectionStatus === 'connected') return;

    const fetchBoats = async () => {
      try {
        const res = await apiClient.get("gps/geojson/?threshold=3");
        const data = res.data;
        
        const latest = new Map();
        if (data?.features) {
          for (const feat of data.features) {
            // Use boat_id as the consistent unique identifier from backend
            const id = feat?.properties?.boat_id;
            const trackerId = feat?.properties?.tracker_id || feat?.properties?.BirukBilugID;
            
            // Skip if no valid ID
            if (!id) {
              console.warn('[MAP] Skipping GPS feature without boat_id:', feat);
              continue;
            }
            
            // ONLY filter out LOST devices (devices marked as is_active=false in device-tokens)
            // DO NOT filter out offline trackers - they should remain visible on the map
            if (trackerId && deviceTokens.has(trackerId)) {
              const token = deviceTokens.get(trackerId);
              if (token.is_active === false) {
                console.log(`[MAP] Filtering out LOST device (is_active=false): ${trackerId}`);
                continue; // Skip this feature - device is lost/deactivated
              }
            }
            
            // Keep all other trackers (including offline ones) - they will be styled accordingly
            if (!latest.has(id)) latest.set(id, feat);
          }
        }

        const applyComputedStatus = (feature) => {
          const timestamp = feature?.properties?.timestamp || '';
          const ts = Date.parse(timestamp);
          const age = Number.isFinite(ts) ? Math.floor((Date.now() - ts) / 1000) : null;
          
          // CRITICAL FIX: Use backend's status if provided (from TrackerStatusEvent)
          const backendStatus = feature?.properties?.status;
          const computedStatus = age != null && age > OFFLINE_THRESHOLD_SECONDS ? 'offline' : 'online';
          const finalStatus = backendStatus || computedStatus;
          
          return { ...feature, properties: { ...feature.properties, status: finalStatus, age_seconds: age } };
        };

        setSmoothFeatures((prev) => {
          const prevMap = new Map(
            (prev || []).map((f) => [f?.properties?.boat_id, f])
          );
          
          // Track which boat IDs are in the new data
          const activeBoatIds = new Set(latest.keys());
          
          const next = [];
          
          for (const [id, feat] of latest.entries()) {
            const [lng, lat] = feat.geometry.coordinates || [0, 0];
            const prevFeat = prevMap.get(id);
            
            if (prevFeat) {
              const [plng, plat] = prevFeat.geometry.coordinates || [0, 0];
              const distance = calculateDistance(plat, plng, lat, lng);
              
              if (isFinite(distance) && distance < DEAD_BAND_METERS) {
                next.push(applyComputedStatus({
                  ...prevFeat,
                  properties: { ...prevFeat.properties, ...feat.properties },
                }));
                continue;
              }
              
              setPreviousFeatures(prevFeatures => {
                const newPrevFeatures = new Map(prevFeatures);
                newPrevFeatures.set(id, prevFeat);
                return newPrevFeatures;
              });
            }
            next.push(applyComputedStatus(feat));
          }
          
          // PRESERVE OFFLINE TRACKERS: Keep previous trackers that aren't in the new data
          // This ensures offline trackers remain visible on the map
          prevMap.forEach((prevFeat, prevId) => {
            if (!activeBoatIds.has(prevId)) {
              // This tracker isn't in the latest update - it's offline
              // Keep it visible with its last known position and offline status
              next.push(applyComputedStatus(prevFeat));
            }
          });
          
          console.log(`[MAP] Poll: Active boats: ${activeBoatIds.size}, Total rendered markers (including offline): ${next.length}`);
          return next;
        });
      } catch (err) {
        // Only log if it's not a 404 or network error (which is expected when no data)
        if (err.response && err.response.status !== 404) {
          console.error("Failed to fetch boat locations", err);
        }
      }
    };

    fetchBoats();
    const interval = setInterval(fetchBoats, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus, deviceTokens]);

  // Memoized styles and handlers (same as before)
  const getLandStyle = useMemo(() => (feature) => {
    const name = feature.properties.name;
    return {
      fillColor: municipalityColors[name] || "#CCCCCC",
      weight: 2,
      opacity: 1,
      color: selectedMunicipality === name ? "#000" : "#666",
      fillOpacity: selectedMunicipality === name ? 0.7 : 0.5,
      interactive: true,
    };
  }, [selectedMunicipality, municipalityColors]);

  const getWaterStyle = useMemo(() => (feature) => {
    const name = feature.properties.name;
    const baseColor = municipalityColors[name] || "#CCCCCC";
    return {
      fillColor: baseColor,
      weight: 2,
      opacity: 0.8,
      color: selectedMunicipality === name ? "#000" : "#666",
      fillOpacity: 0.25,
      dashArray: "5, 5",
      interactive: true,
    };
  }, [selectedMunicipality, municipalityColors]);

  const onEachLandFeature = useMemo(() => (feature, layer) => {
    const name = feature.properties.name;
    layer.on({
      mouseover: () => setSelectedMunicipality(name),
      mouseout: () => setSelectedMunicipality(null),
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedMunicipality(name);
      },
    });
    layer.bindTooltip(
      `<div>
        <strong>${name}</strong><br/>
        Coastline Length: ${feature.properties.coastlineLength || "n/a"} km
      </div>`,
      { sticky: true }
    );
  }, []);

  const onEachWaterFeature = useMemo(() => (feature, layer) => {
    const name = feature.properties.name;
    const waterArea = feature.properties.waterArea || "n/a";
    const coastlineLength = feature.properties.coastlineLength || "n/a";
    
    layer.on({
      mouseover: () => setSelectedMunicipality(name),
      mouseout: () => setSelectedMunicipality(null),
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedMunicipality(name);
      },
    });
    layer.bindTooltip(
      `<div>
        <strong>${name}</strong><br/>
        Water Area: ${waterArea} sq km<br/>
        Coastline Length: ${coastlineLength} km
      </div>`,
      { sticky: true }
    );
  }, []);

  // Boat styling utilities: color by municipality (fallback to id-based hue)
  const getBoatColor = useMemo(() => (id) => {
    const key = String(id ?? '');
    const muniRaw = boatMunicipalityMap.get(key) || boatMunicipalityMap.get(id);
    const muni = normalizeMuni(muniRaw);
    if (muni && municipalityColors[muni]) return municipalityColors[muni];
    // Stable hash to hue for any string/number id
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 45%)`;
  }, [boatMunicipalityMap, municipalityColors]);

  const createBoatIcon = useMemo(() => (color, status, isViolating, iconType = 'boat') =>
    L.divIcon({
      className: "boat-icon-wrapper",  // Add a class for debugging
      html: iconType === 'circle'
        ? `<div class="boat-marker boat-marker-circle ${status === "offline" ? "offline" : ""} ${isViolating ? "violating" : ""}">
            <div class="marker-inner" style="background-color: ${color};"></div>
          </div>`
        : iconType === 'triangle'
        ? `<div class="boat-marker boat-marker-triangle ${status === "offline" ? "offline" : ""} ${isViolating ? "violating" : ""}">
            <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 20h20L12 2z" />
            </svg>
          </div>`
        : `<div class="boat-marker ${status === "offline" ? "offline" : ""} ${isViolating ? "violating" : ""}">
            <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <path d="M20,21H4V19L6,17V11H10V7H6.5V5H17.5V7H14V11H18V17L20,19V21M14,18H10V13H14V18Z" />
            </svg>
          </div>`,
      iconSize: [24, 24],  // Increased from 18x18 to make it more visible
      iconAnchor: [12, 12],  // Adjusted anchor point
    }), []);


  const mapStyle = `
    .leaflet-container {
      outline: none !important;
    }
    .leaflet-interactive {
      outline: none !important;
    }
    /* Clean popup styling - remove duplicate shadows */
    .leaflet-popup-content-wrapper {
      box-shadow: 0 3px 14px rgba(0,0,0,0.3) !important;
      border-radius: 12px !important;
    }
    .leaflet-popup-tip {
      box-shadow: none !important;
    }
    /* Hide default popup shadow that creates duplicate effect */
    .leaflet-popup-pane .leaflet-popup {
      filter: none !important;
    }
  `;

  const markerCSS = `
    /* Fix for Leaflet icon wrapper */
    .boat-icon-wrapper {
      background: transparent !important;
      border: none !important;
      font-size: 0 !important; /* Hide any text fallback */
      overflow: visible !important;
    }
    .leaflet-marker-icon, .leaflet-div-icon { 
      pointer-events: auto;
      background: transparent !important;
      border: none !important;
    }
    .boat-marker {
      width: 24px !important;
      height: 24px !important;
      display: inline-block !important;
      position: relative;
      transition: all 0.3s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      pointer-events: auto; /* allow marker to receive clicks */
    }
    .boat-marker svg {
      width: 100%;
      height: 100%;
      stroke: #ffffff;
      stroke-width: 1.5;
      transition: all 0.3s ease;
      pointer-events: none; /* do not block marker click */
    }
    .boat-marker-circle {
      width: 20px;
      height: 20px;
    }
    .boat-marker-circle .marker-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      pointer-events: none; /* decorative */
    }
    .boat-marker-triangle svg {
      stroke-width: 1;
    }
    .boat-marker::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 24px;
      height: 24px;
      margin-left: -12px;
      margin-top: -12px;
      border: 2px solid currentColor;
      border-radius: 50%;
      opacity: 0.5;
      animation: boatPulse 1.8s ease-out infinite;
      pointer-events: none; /* prevent ring from blocking click */
    }
    .boat-marker.violating {
      width: 28px;
      height: 28px;
      filter: drop-shadow(0 0 8px rgba(220,38,38,0.9));
    }
    .boat-marker-circle.violating {
      width: 24px;
      height: 24px;
    }
    .boat-marker-circle.violating .marker-inner {
      border-width: 3px;
    }
    .boat-marker.violating svg {
      stroke: #fff;
      stroke-width: 2;
    }
    .boat-marker.violating::after {
      border-color: #dc2626;
      border-width: 3px;
      animation: violationPulse 1.2s ease-out infinite;
    }
    .boat-marker.offline {
      filter: grayscale(100%) saturate(0.4) drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      opacity: 0.65;
      pointer-events: auto; /* ensure offline boats are still clickable */
      cursor: pointer;
    }
    .boat-marker.offline::after { display: none; }
    @keyframes boatPulse {
      0% { transform: scale(1); opacity: 0.7; }
      70% { transform: scale(2.2); opacity: 0; }
      100% { opacity: 0; }
    }
    @keyframes violationPulse {
      0% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(2.5); opacity: 0.3; }
      100% { transform: scale(3); opacity: 0; }
    }
  `;

  return (
    <>
      <style>{mapStyle + markerCSS}</style>
      <MapContainer
        center={[16.6154, 120.3199]}
        zoom={12}
        scrollWheelZoom={true}
        zoomControl={true}
        className="h-full w-full z-0"
        dragging={true}
        doubleClickZoom={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {landBoundaries && (boundaryType === "land" || boundaryType === "both") && (
          <GeoJSON
            data={landBoundaries}
            style={getLandStyle}
            onEachFeature={onEachLandFeature}
          />
        )}

        {waterBoundaries && (boundaryType === "water" || boundaryType === "both") && (
          <GeoJSON
            data={waterBoundaries}
            style={getWaterStyle}
            onEachFeature={onEachWaterFeature}
          />
        )}

        {/* Render ultra-smooth boat markers with prediction */}
        {smoothFeatures && smoothFeatures
          .filter((feature) => {
            // Filter by MFBR search
            if (!searchMfbr || searchMfbr.trim() === "") return true;
            const mfbr = String(feature.properties.mfbr_number || feature.properties.boat_id || "").toLowerCase();
            return mfbr.includes(searchMfbr.toLowerCase());
          })
          .map((feature) => {
            // Use boat_id from backend as the consistent unique identifier
            const boatId = feature.properties.boat_id;
            
            // Use WebSocket notification OR backend 'in_violation' flag
            const isViolating = violatingBoats.has(boatId) || violatingBoats.has(String(boatId)) || !!feature?.properties?.in_violation;
            
            return (
              <UltraSmoothBoatMarker
                key={boatId}
                feature={feature}
                previousFeature={previousFeatures.get(boatId)}
                getBoatColor={getBoatColor}
                createBoatIcon={createBoatIcon}
                isViolating={isViolating}
                onViewHistory={handleViewHistory}
              />
            );
          })}

      </MapContainer>

      {/* Legend with Collapsible Toggle */}
      <div className="absolute bottom-20 right-4 bg-white/95 rounded-xl shadow-lg z-20 transition-all duration-300">
        {/* Header with Toggle Button */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h4 className="font-medium text-sm">Municipalities</h4>
          <button
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            aria-label={isLegendExpanded ? "Collapse legend" : "Expand legend"}
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
                isLegendExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {/* Collapsible Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isLegendExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {municipalityOrder.map((name) => {
                const color = municipalityColors[name] || "#CCCCCC";
                return (
                  <div key={name} className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {/* Boat dot */}
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      {/* Land and water squares */}
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.55 }} />
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.25 }} />
                    </div>
                    <span className="truncate">{name}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-600">
              <div>Circle: Boat color</div>
              <div>Squares: Land / Water</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tracker History Timeline Panel (inline inside map) */}
      {showHistoryTimeline && selectedTrackerData && (
        <TrackerHistoryTimeline
          trackerId={selectedTrackerData.trackerId}
          boatData={selectedTrackerData.boatData}
          onClose={() => setShowHistoryTimeline(false)}
          inline={true}
        />
      )}
      
      {/* Violation Toast Notification */}
      {violationNotification && (
        <ViolationToast
          notification={violationNotification}
          onDismiss={() => setViolationNotification(null)}
        />
      )}
    </>
  );
};

export default MapView;
