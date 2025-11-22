import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Marker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { apiClient } from "../services/api_urls";
import { getMunicipalities } from "../services/municipalityService";
import municipalGeoJSON from "./geoData/map_municipal";
import waterBoundaries from "./geoData/water_boundaries";

// Enhanced GPS prediction and interpolation utilities
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

// Ultra-smooth interpolation hook with prediction
const useUltraSmoothInterpolation = (targetPosition, previousPosition, lastUpdateTime, duration = 3000) => {
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

      // Use easing function for smoother animation
      const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic

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
  }, [targetPosition?.lat, targetPosition?.lng, duration, currentPosition, previousPosition, lastUpdateTime]);

  return currentPosition;
};

// Enhanced Boat Marker Component with ultra-smooth movement and prediction
const UltraSmoothBoatMarker = ({ feature, previousFeature, getBoatColor, createBoatIcon }) => {
  // GeoJSON stores coordinates as [lng, lat]
  const coords = feature?.geometry?.coordinates || [];
  const [lng, lat] = coords;
  const hasValid = Number.isFinite(lat) && Number.isFinite(lng);
  const targetPosition = hasValid ? { lat, lng } : { lat: 0, lng: 0 };
  
  // Get previous position for prediction
  let previousPosition = null;
  if (previousFeature && Array.isArray(previousFeature?.geometry?.coordinates)) {
    const [prevLng, prevLat] = previousFeature.geometry.coordinates;
    if (Number.isFinite(prevLat) && Number.isFinite(prevLng)) {
      previousPosition = { lat: prevLat, lng: prevLng };
    }
  }

  const lastUpdateTime = new Date(feature.properties.timestamp).getTime();
  const currentPosition = useUltraSmoothInterpolation(targetPosition, previousPosition, lastUpdateTime, 2000);
  
  if (!hasValid) {
    console.warn('Skipping marker with invalid coordinates', coords, feature?.properties);
    return null;
  }
  
  const { boat_id, mfbr_number, timestamp, status, age_seconds, in_violation, identifier_icon } = feature.properties;

  // Prefer backend marker_color; fallback to municipality-derived color
  const idForColor = mfbr_number || boat_id;
  let color = feature?.properties?.marker_color || getBoatColor(idForColor);
  if (in_violation) {
    color = "#e53935"; // Red for violation
  }
  // Offline keeps color; CSS dims
  const iconType = identifier_icon || 'boat';
  const icon = createBoatIcon(color, status, in_violation, iconType);

  // Calculate speed for display
  let speedKmh = 0;
  if (previousFeature && previousPosition) {
    const timeDiff = lastUpdateTime - new Date(previousFeature.properties.timestamp).getTime();
    if (timeDiff > 0) {
      const speed = calculateSpeed(previousPosition.lat, previousPosition.lng, targetPosition.lat, targetPosition.lng, timeDiff);
      speedKmh = (speed * 3.6); // Convert m/s to km/h
    }
  }

  return (
    <Marker 
      position={[currentPosition.lat, currentPosition.lng]} 
      icon={icon}
      zIndexOffset={1000}
    >
      <Tooltip sticky>
        <div>
          <strong>Boat ID:</strong> {boat_id}<br/>
          <strong>Status:</strong> {status?.toUpperCase() || "UNKNOWN"}<br/>
          <strong>Speed:</strong> {speedKmh > 0 ? `${speedKmh.toFixed(1)} km/h` : "Stationary"}<br/>
          <strong>Last update:</strong> {new Date(timestamp).toLocaleString()}<br/>
          <strong>Age:</strong> {Math.floor((age_seconds || 0) / 60)}m {(age_seconds || 0) % 60}s ago
        </div>
      </Tooltip>
    </Marker>
  );
};

// WebSocket Hook for Real-time GPS Updates (same as before)
const useWebSocketGPS = () => {
  const [gpsData, setGpsData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/gps/`;
    
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected for GPS updates');
          setConnectionStatus('connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'gps_update' || message.type === 'initial_data') {
              setGpsData(message.data);
            } else if (message.type === 'boundary_notification') {
              // Handle boundary violation notification
              const data = message.data;
              console.log('🚨 Boundary violation notification received:', data);
              
              // Show toast notification
              if (window.showBoundaryViolationToast) {
                window.showBoundaryViolationToast(data);
              } else {
                // Fallback: use browser notification if available
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Boundary Violation Alert', {
                    body: `Boat ${data.boat_name || data.mfbr_number} entered ${data.to_municipality} from ${data.from_municipality}`,
                    icon: '/alert-icon.png',
                    tag: `violation-${data.id}`,
                  });
                }
                // Also log to console for debugging
                alert(`⚠️ Boundary Violation: Boat ${data.boat_name || data.mfbr_number} entered ${data.to_municipality}`);
              }
            } else if (message.type === 'violation_cleared') {
              // Handle violation cleared notification
              const data = message.data;
              console.log('✅ Violation cleared:', data);
              
              // Show success toast if handler exists
              if (window.showViolationClearedToast) {
                window.showViolationClearedToast(data);
              } else {
                console.log(`✅ Boat ${data.mfbr_number || data.boat_id} returned to home municipality: ${data.returned_to}`);
              }
              
              // Trigger GPS data refresh to update marker color
              if (gpsData) {
                setGpsData({...gpsData, _refreshTrigger: Date.now()});
              }
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          setConnectionStatus('disconnected');
          
          // Attempt to reconnect after 3 seconds
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.CLOSED) {
              connectWebSocket();
            }
          }, 3000);
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { gpsData, connectionStatus };
};

const DEAD_BAND_METERS = 7;

const MapViewUltraSmooth = () => {
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [smoothFeatures, setSmoothFeatures] = useState([]);
  const [previousFeatures, setPreviousFeatures] = useState(new Map()); // Store previous positions for prediction
  const [landBoundaries, setLandBoundaries] = useState(null);
  const [waterBoundaries, setWaterBoundaries] = useState(null);
  const [toastNotifications, setToastNotifications] = useState([]);
  
  // Use WebSocket for real-time updates
  const { gpsData, connectionStatus } = useWebSocketGPS();
  
  // Toast notification handler
  useEffect(() => {
    window.showBoundaryViolationToast = (data) => {
      const toastId = `toast-${Date.now()}`;
      const toast = {
        id: toastId,
        boat_name: data.boat_name || data.mfbr_number,
        from: data.from_municipality,
        to: data.to_municipality,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setToastNotifications(prev => [...prev, toast]);
      
      // Auto-remove after 8 seconds
      setTimeout(() => {
        setToastNotifications(prev => prev.filter(t => t.id !== toastId));
      }, 8000);
    };
    
    return () => {
      delete window.showBoundaryViolationToast;
    };
  }, []);

  // Dynamic municipality colors from database
  const [municipalityColors, setMunicipalityColors] = useState({
    "San Fernando": "#22c55e",
    "City Of San Fernando": "#22c55e", // alias
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
  const [municipalityNames, setMunicipalityNames] = useState([]);

  // Fetch municipality colors and legend names from API
  useEffect(() => {
    const fetchMunicipalityColors = async () => {
      try {
        const municipalities = await getMunicipalities({ is_active: true });
        const colorMap = {};
        const names = [];
        municipalities.forEach((muni) => {
          if (!muni?.name) return;
          names.push(muni.name);
          colorMap[muni.name] = muni.color;
          if (muni.name === 'San Fernando') {
            colorMap['City Of San Fernando'] = muni.color;
          }
          if (muni.name === 'Santo Tomas') {
            colorMap['Sto. Tomas'] = muni.color;
          }
        });
        names.sort((a, b) => a.localeCompare(b));
        setMunicipalityNames(names);
        console.log('Loaded municipality colors from database:', colorMap);
        setMunicipalityColors((prevColors) => ({ ...prevColors, ...colorMap }));
      } catch (error) {
        console.error('Failed to load municipality colors, using defaults:', error);
      }
    };
    fetchMunicipalityColors();
  }, []);

  const defaultMunicipalityOrder = [
    "Agoo","Aringay","Bacnotan","Bagulin","Balaoan","Bangar","Bauang","Burgos","Caba",
    "City Of San Fernando","Luna","Naguilian","Pugo","Rosario","San Gabriel","San Juan",
    "Santo Tomas","Santol","Sudipen","Tubao"
  ];

  const legendMunicipalities = useMemo(
    () => (municipalityNames.length ? municipalityNames : defaultMunicipalityOrder),
    [municipalityNames]
  );

  // Fetch boundaries once on mount
  useEffect(() => {
    const fetchBoundaries = async () => {
      try {
        const res = await apiClient.get("boundaries/");
        const data = res.data;

        const normalizeGeometry = (coords) => {
          if (!coords) return null;
          if (coords.type && coords.coordinates) return coords;
          if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
            return { type: "Polygon", coordinates: [coords] };
          }
          return { type: "MultiPolygon", coordinates: coords };
        };

        const landFeatures = data.map((item) => ({
          type: "Feature",
          properties: {
            name: item.name,
            waterArea: item.water_area,
            coastlineLength: item.coastline_length,
          },
          geometry: normalizeGeometry(item.coordinates),
        }));

        const waterFeatures = data.map((item) => ({
          type: "Feature",
          properties: {
            name: item.name,
            waterArea: item.water_area,
            coastlineLength: item.coastline_length,
            isWater: true,
          },
          geometry: normalizeGeometry(item.coordinates),
        }));

        setLandBoundaries({ type: "FeatureCollection", features: landFeatures });
        setWaterBoundaries({ type: "FeatureCollection", features: waterFeatures });
      } catch (err) {
        console.error("Failed to fetch boundaries", err);
      }
    };

    fetchBoundaries();
  }, []);

  // Process GPS data from WebSocket with deadband filtering and prediction
  useEffect(() => {
    if (!gpsData?.features) return;

    const latest = new Map();
    gpsData.features.forEach(feat => {
      const id = feat?.properties?.mfbr_number || feat?.properties?.boat_id || 0;
      if (!latest.has(id)) latest.set(id, feat);
    });

    const applyComputedStatus = (feature) => {
      const ts = Date.parse(feature?.properties?.timestamp || '');
      const age = Number.isFinite(ts) ? Math.floor((Date.now() - ts) / 1000) : null;
const status = age != null && age > 300 ? 'offline' : 'online';
      return { ...feature, properties: { ...feature.properties, status, age_seconds: age } };
    };

    setSmoothFeatures((prev) => {
      const prevMap = new Map(
        (prev || []).map((f) => [(f?.properties?.mfbr_number || f?.properties?.boat_id || 0), f])
      );
      const next = [];
      
      for (const [id, feat] of latest.entries()) {
        const [lng, lat] = feat.geometry.coordinates || [0, 0];
        const prevFeat = prevMap.get(id);
        
        if (prevFeat) {
          const [plng, plat] = prevFeat.geometry.coordinates || [0, 0];
          const distance = calculateDistance(plat, plng, lat, lng);
          
          if (isFinite(distance) && distance < DEAD_BAND_METERS) {
            // Keep previous geometry; update properties from latest
            next.push(applyComputedStatus({
              ...prevFeat,
              properties: { ...prevFeat.properties, ...feat.properties },
            }));
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
      return next;
    });
  }, [gpsData]);

  // Fallback polling (same as before)
  useEffect(() => {
    if (connectionStatus === 'connected') return;

    const fetchBoats = async () => {
      try {
const res = await apiClient.get("gps/geojson/?threshold=5");
        const data = res.data;
        
        const latest = new Map();
        if (data?.features) {
          for (const feat of data.features) {
            const id = feat?.properties?.mfbr_number || feat?.properties?.boat_id || 0;
            if (!latest.has(id)) latest.set(id, feat);
          }
        }

        const applyComputedStatus = (feature) => {
          const ts = Date.parse(feature?.properties?.timestamp || '');
          const age = Number.isFinite(ts) ? Math.floor((Date.now() - ts) / 1000) : null;
const status = age != null && age > 300 ? 'offline' : 'online';
          return { ...feature, properties: { ...feature.properties, status, age_seconds: age } };
        };

        setSmoothFeatures((prev) => {
          const prevMap = new Map(
            (prev || []).map((f) => [(f?.properties?.mfbr_number || f?.properties?.boat_id || 0), f])
          );
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
          return next;
        });
      } catch (err) {
        console.error("Failed to fetch boat locations", err);
      }
    };

    fetchBoats();
    const interval = setInterval(fetchBoats, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

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

  // Boat styling utilities
  const getBoatColor = useMemo(() => (id) => {
    const hue = (id * 47) % 360;
    return `hsl(${hue}, 70%, 45%)`;
  }, []);

  const createBoatIcon = useMemo(() => (color, status, inViolation, iconType = 'boat') =>
    L.divIcon({
      className: "",
      html: iconType === 'circle'
        ? `<div class="boat-marker boat-marker-circle ${status === "offline" ? "offline" : ""} ${inViolation ? "violation" : ""}">
            <div class="marker-inner" style="background-color: ${color};"></div>
          </div>`
        : iconType === 'triangle'
        ? `<div class="boat-marker boat-marker-triangle ${status === "offline" ? "offline" : ""} ${inViolation ? "violation" : ""}">
            <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 20h20L12 2z" />
            </svg>
          </div>`
        : `<div class="boat-marker ${status === "offline" ? "offline" : ""} ${inViolation ? "violation" : ""}">
            <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <path d="M20,21H4V19L6,17V11H10V7H6.5V5H17.5V7H14V11H18V17L20,19V21M14,18H10V13H14V18Z" />
            </svg>
          </div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }), []);

  const FitBoundsView = ({ geoJsonData }) => {
    const map = useMap();
    useEffect(() => {
      if (!geoJsonData) return;
      const geoJsonLayer = L.geoJSON(geoJsonData);
      const bounds = geoJsonLayer.getBounds();
      const paddedBounds = bounds.pad(0.1);
      map.fitBounds(paddedBounds);
      map.setMinZoom(map.getZoom() - 2);
      map.setMaxZoom(18);
      map.getContainer().style.outline = "none";
    }, [geoJsonData, map]);
    return null;
  };

  const mapStyle = `
    .leaflet-container {
      outline: none !important;
    }
    .leaflet-interactive {
      outline: none !important;
    }
  `;

  const markerCSS = `
    .boat-marker {
      width: 24px;
      height: 24px;
      display: inline-block;
      position: relative;
      transition: all 0.3s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .boat-marker svg {
      width: 100%;
      height: 100%;
      stroke: #ffffff;
      stroke-width: 1.5;
      transition: all 0.3s ease;
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
    }
    .boat-marker.violation {
      width: 28px;
      height: 28px;
      filter: drop-shadow(0 0 8px rgba(220,38,38,0.9));
      animation: violationPulse 1s ease-in-out infinite;
    }
    .boat-marker-circle.violation {
      width: 24px;
      height: 24px;
    }
    .boat-marker-circle.violation .marker-inner {
      border-width: 3px;
    }
    .boat-marker.violation svg {
      stroke: #fff;
      stroke-width: 2;
    }
    .boat-marker.violation::after {
      border-color: #dc2626;
      border-width: 3px;
      animation: violationRing 1.5s ease-out infinite;
    }
    .boat-marker.offline {
      filter: grayscale(100%) saturate(0.4) drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      opacity: 0.65;
    }
    .boat-marker.offline::after { display: none; }
    @keyframes boatPulse {
      0% { transform: scale(1); opacity: 0.7; }
      70% { transform: scale(2.2); opacity: 0; }
      100% { opacity: 0; }
    }
    @keyframes violationPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    @keyframes violationRing {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
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

        {landBoundaries && (
          <GeoJSON
            data={landBoundaries}
            style={getLandStyle}
            onEachFeature={onEachLandFeature}
          />
        )}

        {waterBoundaries && (
          <GeoJSON
            data={waterBoundaries}
            style={getWaterStyle}
            onEachFeature={onEachWaterFeature}
          />
        )}

        {/* Render ultra-smooth boat markers with prediction */}
        {smoothFeatures && smoothFeatures.map((feature) => (
          <UltraSmoothBoatMarker
            key={feature.properties.boat_id}
            feature={feature}
            previousFeature={previousFeatures.get(feature.properties.boat_id)}
            getBoatColor={getBoatColor}
            createBoatIcon={createBoatIcon}
          />
        ))}

        <FitBoundsView geoJsonData={municipalGeoJSON} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-20 right-4 bg-white/95 p-4 rounded-xl shadow-lg z-20">
        <div className="flex items-center justify-end mb-2">
        </div>
        
        {/* Removed online/offline rows; unified legend */}
        <h4 className="font-medium mb-1">Municipalities</h4>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {legendMunicipalities.map((name) => {
            const color = municipalityColors[name] || '#CCCCCC';
            return (
              <div key={name} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.55 }} />
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.25 }} />
                </div>
                <span className="truncate">{name}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-gray-600">
          <div>Circle: Boat color</div>
          <div>Squares: Land / Water</div>
        </div>
      </div>
      
      {/* Toast Notifications for Boundary Violations */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
        {toastNotifications.map((toast) => (
          <div
            key={toast.id}
            className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl animate-slide-in-right flex items-start gap-3 min-w-[320px] max-w-[400px]"
            style={{
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg mb-1">⚠️ Boundary Violation</div>
              <div className="text-sm">
                <strong>{toast.boat_name}</strong> crossed into <strong>{toast.to}</strong>
                {toast.from && ` from ${toast.from}`}
              </div>
              <div className="text-xs mt-1 opacity-75">{toast.timestamp}</div>
            </div>
            <button
              onClick={() => setToastNotifications(prev => prev.filter(t => t.id !== toast.id))}
              className="flex-shrink-0 text-white hover:text-red-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default MapViewUltraSmooth;