import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, MapPin, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ViolationToast.css';

/**
 * Real-time Popup Notification Component for Violations
 * Appears when violation is detected, persists until dismissed
 */
const ViolationToast = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
    }
  }, [notification]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      onDismiss();
    }, 300);
  };

  const handleViewDetails = () => {
    navigate('/notifications');
    handleDismiss();
  };

  if (!notification || !isVisible) return null;

  const { 
    boat_id, 
    owner_name, 
    registration_number, 
    timestamp, 
    timestamp_start,
    timestamp_end,
    idle_minutes,
    location, 
    municipality,
    own_municipality 
  } = notification;

  return (
    <div className={`violation-toast-overlay ${isExiting ? 'exit' : ''}`}>
      <div className={`violation-toast ${isExiting ? 'exit' : ''}`}>
        {/* Header */}
        <div className="toast-header">
          <div className="toast-icon-wrapper">
            <AlertTriangle className="toast-icon" />
          </div>
          <div className="toast-title-section">
            <h3 className="toast-title">Boundary Violation Detected</h3>
            <p className="toast-subtitle">Immediate attention required</p>
          </div>
          <button 
            className="toast-close-btn"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="toast-content">
          {/* Violation Summary - Dynamic data */}
          <div className="toast-summary">
            <p className="toast-text">
              <strong>Boat {boat_id}</strong>, owned by <strong>{owner_name}</strong>, 
              <strong> ({registration_number})</strong>, is now subject to questioning after 
              the boat was observed idle for <strong>{idle_minutes || 15} minutes</strong> from{' '}
              <strong>{timestamp_start ? new Date(timestamp_start).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              }) : 'Unknown'}</strong> to{' '}
              <strong>{timestamp_end ? new Date(timestamp_end).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              }) : new Date(timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}</strong> at location{' '}
              <strong>{location?.lat?.toFixed(6)}, {location?.lng?.toFixed(6)}</strong>,{' '}
              <strong>{municipality}</strong>, away from registered municipality{' '}
              <strong>{own_municipality || 'Unknown'}</strong>.
            </p>
          </div>

          {/* Metadata */}
          <div className="toast-metadata">
            <div className="toast-meta-item">
              <Clock size={16} />
              <span>{new Date(timestamp).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}</span>
            </div>
            <div className="toast-meta-item">
              <MapPin size={16} />
              <span>{location?.lat?.toFixed(6)}, {location?.lng?.toFixed(6)}</span>
            </div>
          </div>

          {/* SMS Notification Status */}
          <div className="toast-status">
            <div className="status-indicator status-sent">
              <div className="status-dot"></div>
              <span>SMS notification sent to fisherfolk's contact person</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="toast-actions">
          <button 
            className="btn-secondary"
            onClick={handleDismiss}
          >
            Dismiss
          </button>
          <button 
            className="btn-primary"
            onClick={handleViewDetails}
          >
            View Full Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationToast;
