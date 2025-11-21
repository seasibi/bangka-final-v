import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Map from "react-map-gl/maplibre";
import {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  ScaleControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import { MapPin, Info, X, AlertTriangle, Activity, Clock } from "lucide-react";
import { apiClient } from "../services/api_urls";
import "maplibre-gl/dist/maplibre-gl.css";

// Enhanced WebSocket Hook for Real-time GPS Updates with multiple device support
const useWebSocketGPS = (onBoundaryNotification, onViolationCleared) => {
  const [gpsData, setGpsData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const wsPort = import.meta.env.VITE_WS_PORT || '8000';
    const wsUrl = `${protocol}//${wsHost}:${wsPort}/ws/gps/`;
    
    const connectWebSocket = () => {
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN || 
            wsRef.current?.readyState === WebSocket.CONNECTING) {
          return;
        }

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('[WebSocket] Connected for GPS updates');
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
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
            } else if (message.type === 'boundary_notification' && onBoundaryNotification) {
              console.log('[WebSocket] Boundary violation detected:', message.data);
              onBoundaryNotification(message.data);
            } else if (message.type === 'violation_cleared' && onViolationCleared) {
              console.log('[WebSocket] Violation cleared:', message.data);
              onViolationCleared(message.data);
            }
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        wsRef.current.onclose = (event) => {
          if (event.code !== 1000 && event.code !== 1006) {
            console.log('[WebSocket] Disconnected:', event.code, event.reason);
          }
          setConnectionStatus('disconnected');
          
          // Exponential backoff reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (document.visibilityState === 'visible') {
              connectWebSocket();
            }
          }, delay);
        };

        wsRef.current.onerror = (error) => {
          setConnectionStatus('error');
        };

      } catch (error) {
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
  }, [onBoundaryNotification, onViolationCleared]);

  return { gpsData, connectionStatus };
};

// Constants for map behavior
const DEAD_BAND_METERS = 7;
const OFFLINE_THRESHOLD_SECONDS = 480; // 8 minutes as requested

// Helper function to calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radius of Earth in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MapViewEnhanced = ({ 
  boundaryType = "both", 
  searchMfbr = "",
  onViewHistory,
  showHistoryTimeline,
  setShowHistoryTimeline,
  selectedTrackerData,
  setSelectedTrackerData
}) => {
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [smoothFeatures, setSmoothFeatures] = useState([]);
  const [deviceMarkers, setDeviceMarkers] = useState(new Map()); // Store all device markers
  const [previousFeatures, setPreviousFeatures] = useState(new Map());
  const [landBoundaries, setLandBoundaries] = useState(null);
  const [waterBoundaries, setWaterBoundaries] = useState(null);
  const [violatingBoats, setViolatingBoats] = useState(new Set());
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [municipalityColors, setMunicipalityColors] = useState({});
  const [deviceTokens, setDeviceTokens] = useState(new Map());
  const mapRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Handle view history click
  const handleViewHistory = useCallback((trackerId, boatData) => {
    if (onViewHistory) {
      onViewHistory(trackerId, boatData);
    } else {
      setSelectedTrackerData({ trackerId, boatData });
      setShowHistoryTimeline(true);
    }
  }, [onViewHistory, setSelectedTrackerData, setShowHistoryTimeline]);
  
  // Handle boundary violation notifications
  const handleBoundaryNotification = useCallback((notificationData) => {
    const boatId = notificationData.mfbr_number || notificationData.boat_name;
    if (boatId) {
      setViolatingBoats(prev => new Set([...prev, boatId]));
    }
  }, []);

  // Handle violation cleared
  const handleViolationCleared = useCallback((data) => {
    const id1 = data?.mfbr_number ? String(data.mfbr_number) : null;
    const id2 = data?.boat_id != null ? String(data.boat_id) : null;
    setViolatingBoats(prev => {
      const next = new Set(prev);
      if (id1) next.delete(id1);
      if (id2) next.delete(id2);
      return next;
    });
  }, []);
  
  // Use WebSocket for real-time updates
  const { gpsData, connectionStatus } = useWebSocketGPS(
    handleBoundaryNotification, 
    handleViolationCleared
  );

  // Fetch municipality colors
  useEffect(() => {
    const fetchMunicipalities = async () => {
      try {
        const response = await apiClient.get('municipalities/');
        const colors = {};
        response.data.forEach(muni => {
          colors[muni.name] = muni.color || "#6b7280";
        });
        setMunicipalityColors(colors);
      } catch (error) {
        console.error('[MAP] Failed to fetch municipality colors:', error);
      }
    };
    fetchMunicipalities();
  }, []);

  // Fetch device token statuses
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
        console.error('[MAP] Failed to fetch device token statuses:', error);
      }
    };
    
    fetchTokenStatuses();
    const interval = setInterval(fetchTokenStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  // Process GPS data with enhanced multiple device tracking
  useEffect(() => {
    if (!gpsData?.features) return;

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const processedFeatures = new Map();
      const now = Date.now();

      gpsData.features.forEach(feat => {
        // Get unique identifier for each device
        const trackerId = feat?.properties?.tracker_id || feat?.properties?.BirukBilugID;
        const mfbrNumber = feat?.properties?.mfbr_number;
        const boatId = feat?.properties?.boat_id;
        
        // Create composite ID that's consistent across updates
        const uniqueId = trackerId || mfbrNumber || `boat_${boatId}`;
        
        // Skip lost/inactive devices
        if (trackerId && deviceTokens.has(trackerId)) {
          const token = deviceTokens.get(trackerId);
          if (token.is_active === false) {
            console.log(`[MAP] Filtering out lost device: ${trackerId}`);
            return;
          }
        }
        
        // Calculate age and status
        const timestamp = feat?.properties?.timestamp || '';
        const ts = Date.parse(timestamp);
        const age = Number.isFinite(ts) ? Math.floor((now - ts) / 1000) : null;
        
        // Use backend status if provided, otherwise calculate based on age
        const backendStatus = feat?.properties?.status;
        let computedStatus = 'online';
        
        if (backendStatus) {
          computedStatus = backendStatus;
        } else if (age != null) {
          if (age > OFFLINE_THRESHOLD_SECONDS) {
            computedStatus = 'offline';
          } else if (age > OFFLINE_THRESHOLD_SECONDS / 2) {
            computedStatus = 'reconnecting';
          }
        }
        
        // Apply deadband filter
        const currentMarker = deviceMarkers.get(uniqueId);
        if (currentMarker) {
          const [prevLng, prevLat] = currentMarker.geometry.coordinates || [0, 0];
          const [newLng, newLat] = feat.geometry.coordinates || [0, 0];
          const distance = calculateDistance(prevLat, prevLng, newLat, newLng);
          
          if (isFinite(distance) && distance < DEAD_BAND_METERS) {
            // Keep previous position but update properties
            processedFeatures.set(uniqueId, {
              ...currentMarker,
              properties: {
                ...currentMarker.properties,
                ...feat.properties,
                status: computedStatus,
                age_seconds: age,
                unique_id: uniqueId
              }
            });
            return;
          }
        }
        
        // Add/Update feature
        processedFeatures.set(uniqueId, {
          ...feat,
          properties: {
            ...feat.properties,
            status: computedStatus,
            age_seconds: age,
            unique_id: uniqueId
          }
        });
      });

      // Update device markers state
      setDeviceMarkers(processedFeatures);
      
      // Convert to array for rendering
      setSmoothFeatures(Array.from(processedFeatures.values()));
      
      console.log(`[MAP] Active devices: ${processedFeatures.size}`);
    });
  }, [gpsData, deviceTokens, deviceMarkers]);

  // Fallback HTTP polling when WebSocket is disconnected
  useEffect(() => {
    if (connectionStatus === 'connected') return;

    const fetchBoats = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const res = await apiClient.get("gps/geojson/?threshold=3");
        const data = res.data;
        
        if (data?.features) {
          // Process similar to WebSocket data
          const processedMap = new Map();
          const now = Date.now();

          data.features.forEach(feat => {
            const trackerId = feat?.properties?.tracker_id || feat?.properties?.BirukBilugID;
            const mfbrNumber = feat?.properties?.mfbr_number;
            const boatId = feat?.properties?.boat_id;
            const uniqueId = trackerId || mfbrNumber || `boat_${boatId}`;
            
            // Skip inactive devices
            if (trackerId && deviceTokens.has(trackerId)) {
              const token = deviceTokens.get(trackerId);
              if (token.is_active === false) return;
            }
            
            processedMap.set(uniqueId, feat);
          });

          // Merge with existing device markers
          setDeviceMarkers(prevMarkers => {
            const merged = new Map(prevMarkers);
            processedMap.forEach((feat, id) => {
              merged.set(id, feat);
            });
            return merged;
          });

          setSmoothFeatures(Array.from(processedMap.values()));
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error("[MAP] Failed to fetch boat locations", err);
        }
      }
    };

    fetchBoats();
    const interval = setInterval(fetchBoats, 5000);
    return () => clearInterval(interval);
  }, [connectionStatus, deviceTokens]);

  // Fetch boundaries
  useEffect(() => {
    const fetchBoundaries = async () => {
      try {
        const [landRes, waterRes] = await Promise.all([
          apiClient.get("land-boundaries/"),
          apiClient.get("boundaries/")
        ]);

        const normalizeGeometry = (coords) => {
          if (!coords) return null;
          if (coords.type && coords.coordinates) return coords;
          if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
            return { type: "Polygon", coordinates: [coords] };
          }
          return { type: "MultiPolygon", coordinates: coords };
        };

        const landFeatures = landRes.data.map((item) => ({
          type: "Feature",
          properties: {
            name: item.name,
            municipality: item.municipality_name
          },
          geometry: normalizeGeometry(item.coordinates),
        }));

        const waterFeatures = waterRes.data.map((item) => ({
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
        console.error("[MAP] Failed to fetch boundaries", err);
      }
    };

    fetchBoundaries();
  }, []);

  // Get marker color based on status and violation
  const getMarkerColor = useCallback((feature) => {
    const mfbrNumber = feature?.properties?.mfbr_number;
    const status = feature?.properties?.status;
    
    if (violatingBoats.has(mfbrNumber)) {
      return "#ef4444"; // Red for violations
    }
    
    switch (status) {
      case 'offline':
        return "#6b7280"; // Gray
      case 'reconnecting':
        return "#f59e0b"; // Orange
      case 'online':
      default:
        const regMuni = feature?.properties?.registered_municipality;
        return municipalityColors[regMuni] || "#10b981"; // Green default
    }
  }, [violatingBoats, municipalityColors]);

  // Render boat markers
  const renderBoatMarkers = useMemo(() => {
    if (!smoothFeatures || smoothFeatures.length === 0) return null;

    return smoothFeatures.map((feature) => {
      const [lng, lat] = feature.geometry.coordinates || [0, 0];
      const props = feature.properties || {};
      const uniqueId = props.unique_id || props.tracker_id || props.mfbr_number || props.boat_id;
      const displayName = props.boat_name || props.mfbr_number || `Device ${uniqueId}`;
      const status = props.status || 'unknown';
      const ageSeconds = props.age_seconds;
      
      return (
        <Marker
          key={`marker-${uniqueId}`}
          longitude={lng}
          latitude={lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setSelectedBoat(feature);
          }}
        >
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
              style={{ 
                backgroundColor: getMarkerColor(feature),
                opacity: status === 'offline' ? 0.6 : 1
              }}
            >
              {status === 'offline' ? (
                <X className="text-white" size={16} />
              ) : status === 'reconnecting' ? (
                <Activity className="text-white animate-pulse" size={16} />
              ) : (
                <MapPin className="text-white" size={16} />
              )}
            </div>
            {violatingBoats.has(props.mfbr_number) && (
              <div className="absolute -top-2 -right-2">
                <AlertTriangle className="text-red-500 animate-pulse" size={16} />
              </div>
            )}
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow-md text-xs whitespace-nowrap">
              {displayName}
              {ageSeconds > 60 && (
                <span className="text-gray-500 ml-1">
                  ({Math.floor(ageSeconds / 60)}m ago)
                </span>
              )}
            </div>
          </div>
        </Marker>
      );
    });
  }, [smoothFeatures, violatingBoats, getMarkerColor]);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 120.3152,
          latitude: 16.6195,
          zoom: 11,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://api.maptiler.com/maps/basic-v2/style.json?key=h2lsCnTgWLgUkPO3t6Q1"
        attributionControl={false}
      >
        {/* Boundaries */}
        {boundaryType !== "water" && landBoundaries && (
          <Source id="land-boundaries" type="geojson" data={landBoundaries}>
            <Layer
              id="land-boundaries-fill"
              type="fill"
              paint={{
                "fill-color": "#3b82f6",
                "fill-opacity": 0.1,
              }}
            />
            <Layer
              id="land-boundaries-line"
              type="line"
              paint={{
                "line-color": "#3b82f6",
                "line-width": 2,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}
        
        {boundaryType !== "land" && waterBoundaries && (
          <Source id="water-boundaries" type="geojson" data={waterBoundaries}>
            <Layer
              id="water-boundaries-fill"
              type="fill"
              paint={{
                "fill-color": "#06b6d4",
                "fill-opacity": 0.05,
              }}
            />
            <Layer
              id="water-boundaries-line"
              type="line"
              paint={{
                "line-color": "#06b6d4",
                "line-width": 2,
              }}
            />
          </Source>
        )}

        {/* Boat Markers */}
        {renderBoatMarkers}

        {/* Selected Boat Popup */}
        {selectedBoat && (
          <Popup
            longitude={selectedBoat.geometry.coordinates[0]}
            latitude={selectedBoat.geometry.coordinates[1]}
            onClose={() => setSelectedBoat(null)}
            closeButton={false}
            className="boat-popup"
          >
            <div className="p-3 max-w-xs">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">
                  {selectedBoat.properties.boat_name || 
                   selectedBoat.properties.mfbr_number || 
                   'Unknown Boat'}
                </h3>
                <button
                  onClick={() => setSelectedBoat(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-1 text-sm">
                {selectedBoat.properties.mfbr_number && (
                  <div>
                    <span className="text-gray-600">MFBR:</span>{" "}
                    <span className="font-medium">
                      {selectedBoat.properties.mfbr_number}
                    </span>
                  </div>
                )}
                {selectedBoat.properties.tracker_id && (
                  <div>
                    <span className="text-gray-600">Tracker:</span>{" "}
                    <span className="font-medium">
                      {selectedBoat.properties.tracker_id}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Status:</span>{" "}
                  <span
                    className={`font-medium ${
                      selectedBoat.properties.status === 'online'
                        ? 'text-green-600'
                        : selectedBoat.properties.status === 'reconnecting'
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {selectedBoat.properties.status}
                  </span>
                </div>
                {selectedBoat.properties.registered_municipality && (
                  <div>
                    <span className="text-gray-600">Municipality:</span>{" "}
                    <span className="font-medium">
                      {selectedBoat.properties.registered_municipality}
                    </span>
                  </div>
                )}
                {selectedBoat.properties.age_seconds && (
                  <div>
                    <span className="text-gray-600">Last Update:</span>{" "}
                    <span className="font-medium">
                      {selectedBoat.properties.age_seconds < 60
                        ? `${selectedBoat.properties.age_seconds}s ago`
                        : `${Math.floor(selectedBoat.properties.age_seconds / 60)}m ago`}
                    </span>
                  </div>
                )}
              </div>
              {selectedBoat.properties.tracker_id && (
                <button
                  onClick={() => handleViewHistory(
                    selectedBoat.properties.tracker_id,
                    selectedBoat.properties
                  )}
                  className="mt-3 w-full bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors text-sm"
                >
                  View History
                </button>
              )}
            </div>
          </Popup>
        )}

        {/* Map Controls */}
        <NavigationControl position="top-right" />
        <ScaleControl />
        <GeolocateControl />
      </Map>

      {/* Connection Status Indicator */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-3 py-2">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-500'
                : connectionStatus === 'error'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
          />
          <span className="text-sm text-gray-700">
            {connectionStatus === 'connected'
              ? `Live (${smoothFeatures.length} devices)`
              : 'Reconnecting...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapViewEnhanced;
