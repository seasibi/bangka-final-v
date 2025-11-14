import React from 'react';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Wifi, WifiOff, Activity, MapPin, Clock, Navigation, History } from 'lucide-react';

/**
 * Enhanced Boat Info Popup Component
 * Creates a rich, interactive popup for boat markers on the map
 */
export const createBoatPopupContent = (feature, onViewHistory) => {
  const {
    boat_id,
    mfbr_number,
    boat_name,
    latitude,
    longitude,
    status,
    timestamp,
    tracker_id,
    municipality,
    age_seconds,
    identifier_icon,
    in_violation
  } = feature.properties;

  const displayMfbr = (mfbr_number && String(mfbr_number).trim() && String(mfbr_number) !== '0')
    ? mfbr_number
    : ((boat_id && String(boat_id).trim() && String(boat_id) !== '0') ? boat_id : 'Unknown');

  const displayBoatName = boat_name || 'Unknown Boat';
  
  const displayLat = Number.isFinite(Number(latitude))
    ? Number(latitude).toFixed(6)
    : (typeof feature.geometry.coordinates?.[1] === 'number' ? feature.geometry.coordinates[1].toFixed(6) : 'N/A');
  
  const displayLon = Number.isFinite(Number(longitude))
    ? Number(longitude).toFixed(6)
    : (typeof feature.geometry.coordinates?.[0] === 'number' ? feature.geometry.coordinates[0].toFixed(6) : 'N/A');

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleString();
  };

  // Determine connection status
  const getStatusInfo = () => {
    if (status === 'offline' || age_seconds > 600) {
      return {
        label: 'Offline',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        icon: 'wifi-off'
      };
    } else if (age_seconds > 180) { // 3 minutes = reconnecting
      return {
        label: 'Reconnecting',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        icon: 'activity'
      };
    } else {
      return {
        label: 'Online',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        icon: 'wifi'
      };
    }
  };

  const statusInfo = getStatusInfo();
  const timeSinceUpdate = getTimeSinceUpdate();

  // Create unique ID for this popup
  const popupId = `popup-${tracker_id || boat_id || Date.now()}`;

  return `
    <div class="boat-popup-content" style="font-family: 'Montserrat', sans-serif; min-width: 280px; max-width: 320px;">
      <!-- Header -->
      <div class="popup-header" style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 16px; border-radius: 12px 12px 0 0; margin: -20px -20px 0 -20px;">
        <div style="display: flex; align-items: start; justify-content: space-between;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusInfo.label === 'Online' ? '#10b981' : statusInfo.label === 'Reconnecting' ? '#f59e0b' : '#6b7280'}; box-shadow: 0 0 0 2px rgba(255,255,255,0.3);"></div>
              <span style="color: white; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                ${statusInfo.label}
              </span>
            </div>
            <h3 style="color: white; font-size: 16px; font-weight: bold; margin: 0; line-height: 1.3;">
              ${displayBoatName}
            </h3>
            <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 4px 0 0 0; font-weight: 500;">
              MFBR: ${displayMfbr}
            </p>
          </div>
          ${in_violation ? `
            <div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; border-radius: 8px; padding: 6px; animation: pulse-warning 2s infinite;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Content -->
      <div style="padding: 16px 0;">
        <!-- Tracker Info -->
        ${tracker_id ? `
          <div style="background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                Tracker Information
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; color: #475569;">Tracker ID:</span>
              <span style="font-size: 13px; font-weight: 600; color: #1e293b; font-family: 'Courier New', monospace;">
                ${tracker_id}
              </span>
            </div>
          </div>
        ` : ''}

        <!-- Location Details -->
        <div style="background: #f0f9ff; border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid #bfdbfe;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span style="font-size: 12px; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px;">
              Current Location
            </span>
          </div>
          <div style="space-y: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 12px; color: #475569;">Latitude:</span>
              <span style="font-size: 12px; font-weight: 600; color: #1e293b; font-family: 'Courier New', monospace;">
                ${displayLat}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 12px; color: #475569;">Longitude:</span>
              <span style="font-size: 12px; font-weight: 600; color: #1e293b; font-family: 'Courier New', monospace;">
                ${displayLon}
              </span>
            </div>
            ${municipality ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="font-size: 12px; color: #475569;">Municipality:</span>
                <span style="font-size: 12px; font-weight: 600; color: #1e293b;">
                  ${municipality}
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Last Update -->
        <div style="background: #fef3c7; border-radius: 8px; padding: 10px; margin-bottom: 14px; border: 1px solid #fde68a;">
          <div style="display: flex; items-center: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style="font-size: 11px; color: #92400e; font-weight: 500;">
              Last update: ${timeSinceUpdate}
            </span>
          </div>
        </div>

        <!-- Action Button -->
        <button 
          id="view-history-btn-${popupId}"
          data-tracker-id="${tracker_id || boat_id}"
          data-boat-data='${JSON.stringify({ mfbr_number, boat_name, boat_id })}'
          style="width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 12px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.4)';"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.3)';"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          View Tracker History
        </button>
      </div>

      ${in_violation ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; margin-top: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style="font-size: 12px; font-weight: 600; color: #dc2626;">
              Boundary Violation Alert
            </span>
          </div>
        </div>
      ` : ''}
    </div>

    <style>
      @keyframes pulse-warning {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .boat-popup-content {
        font-smoothing: antialiased;
        -webkit-font-smoothing: antialiased;
      }
    </style>
  `;
};

/**
 * Enhanced createBoatPopup function to use with Leaflet markers
 */
export const createBoatPopup = (feature, onViewHistory) => {
  const popupContent = createBoatPopupContent(feature, onViewHistory);
  
  const popup = L.popup({
    maxWidth: 320,
    minWidth: 280,
    className: 'custom-boat-popup',
    closeButton: true,
    autoPan: true,
    autoPanPadding: [50, 50]
  }).setContent(popupContent);

  return popup;
};
