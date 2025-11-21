import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown, ChevronUp, MapPin, AlertTriangle, Anchor, Navigation, Clock } from 'lucide-react';
import { apiClient } from '../../services/api_urls';

const TrackerHistoryTimelineClean = ({ trackerId, boatData, onClose, inline = false }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('movements'); // movements, violations, all
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const fetchInProgressRef = useRef(false);

  // Fetch history data
  const fetchTrackerHistory = async () => {
    if (fetchInProgressRef.current) return;
    
    fetchInProgressRef.current = true;
    try {
      setLoading(true);
      const response = await apiClient.get(`/tracker-history/${trackerId}/`, {
        params: { filter }
      });
      
      let data = Array.isArray(response.data) ? response.data : [];
      
      // Filter out status events (online, offline)
      data = data.filter(event => {
        const eventType = event.event_type;
        return !['online', 'offline'].includes(eventType);
      });
      
      // Sort by timestamp (newest first)
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setHistory(data);
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('Error fetching tracker history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  // Initial fetch
  useEffect(() => {
    if (trackerId) {
      fetchTrackerHistory();
    }
  }, [trackerId, filter]);
  
  // Auto-refresh every 2 minutes for active trackers
  useEffect(() => {
    if (!trackerId) return;
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTrackerHistory();
      }
    }, 120000); // 2 minutes
    
    return () => clearInterval(interval);
  }, [trackerId, filter]);

  // Get event icon based on type
  const getEventIcon = (eventType) => {
    const iconProps = { size: 20, className: "flex-shrink-0" };
    
    switch (eventType) {
      case 'boundary_crossing':
      case 'location_update':
        return <MapPin {...iconProps} className="text-blue-600" />;
      case 'violation':
        return <AlertTriangle {...iconProps} className="text-red-600" />;
      case 'idle':
      case 'anchored':
        return <Anchor {...iconProps} className="text-orange-600" />;
      case 'moving':
      case 'navigation':
        return <Navigation {...iconProps} className="text-green-600" />;
      default:
        return <Clock {...iconProps} className="text-gray-600" />;
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      // Time of day
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Relative time
      let relativeStr = '';
      if (diffMins < 1) {
        relativeStr = 'Just now';
      } else if (diffMins < 60) {
        relativeStr = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        relativeStr = `${diffHours}h ago`;
      } else if (diffDays === 1) {
        relativeStr = 'Yesterday';
      } else if (diffDays < 7) {
        relativeStr = `${diffDays} days ago`;
      } else {
        relativeStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
      
      return {
        time: timeStr,
        relative: relativeStr,
        full: date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      };
    } catch (error) {
      return {
        time: 'Unknown',
        relative: '',
        full: 'Unknown time'
      };
    }
  };

  // Format event description
  const formatEventDescription = (event) => {
    const meta = event.metadata || {};
    
    switch (event.event_type) {
      case 'boundary_crossing':
        if (meta.from_municipality && meta.to_municipality) {
          return `Moved from ${meta.from_municipality} to ${meta.to_municipality}`;
        } else if (meta.to_municipality) {
          return `Entered ${meta.to_municipality}`;
        }
        return event.description;
        
      case 'violation':
        if (meta.duration) {
          return `${event.description} (Duration: ${meta.duration})`;
        }
        return event.description;
        
      case 'idle':
      case 'anchored':
        if (meta.duration_minutes) {
          const hours = Math.floor(meta.duration_minutes / 60);
          const mins = meta.duration_minutes % 60;
          const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          return `${event.description} (${durationStr})`;
        }
        return event.description;
        
      default:
        return event.description;
    }
  };

  // Filter options
  const filterOptions = [
    { value: 'movements', label: 'Movements', count: history.filter(e => ['boundary_crossing', 'location_update', 'moving'].includes(e.event_type)).length },
    { value: 'violations', label: 'Violations', count: history.filter(e => e.event_type === 'violation').length },
    { value: 'all', label: 'All Events', count: history.length }
  ];

  // Grouped events by date
  const groupedEvents = useMemo(() => {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    history.forEach(event => {
      const eventDate = new Date(event.timestamp);
      let groupKey;
      
      if (eventDate >= today) {
        groupKey = 'Today';
      } else if (eventDate >= yesterday) {
        groupKey = 'Yesterday';
      } else {
        groupKey = eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(event);
    });
    
    return groups;
  }, [history]);

  if (loading && history.length === 0) {
    return (
      <div className={`${inline ? '' : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'}`}>
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Loading history...</span>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div 
      className={`bg-white ${inline ? 'h-full' : 'rounded-lg shadow-xl max-w-3xl w-full'} flex flex-col`}
      style={{ maxHeight: inline ? '100%' : '85vh', height: inline ? '100%' : 'auto' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Tracker History
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {boatData?.boat_name || boatData?.mfbr_number || trackerId}
            {lastUpdateTime && (
              <span className="ml-2">
                • Updated {formatTimestamp(lastUpdateTime).relative}
              </span>
            )}
          </p>
        </div>
        {!inline && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded p-1"
            aria-label="Close tracker history"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-3 border-b flex-shrink-0">
        <div className="flex space-x-4">
          {filterOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                filter === option.value
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
              }`}
              aria-pressed={filter === option.value}
              aria-label={`Filter by ${option.label}`}
            >
              {option.label}
              {option.count > 0 && (
                <span className="ml-2 text-sm">
                  ({option.count})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      <div 
        className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar"
        style={{ 
          minHeight: 0,
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch'
        }}
        role="region"
        aria-label="Tracker history events"
        tabIndex={0}
      >
        {history.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500">No events found</p>
            <p className="text-sm text-gray-400 mt-1">
              Movement and location events will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([date, events]) => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {date}
                </h3>
                <div className="space-y-3">
                  {events.map((event, index) => {
                    const timestamp = formatTimestamp(event.timestamp);
                    const isViolation = event.event_type === 'violation';
                    
                    return (
                      <div
                        key={event.id || index}
                        className={`relative flex items-start space-x-3 p-3 rounded-lg ${
                          isViolation ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getEventIcon(event.event_type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`text-sm ${isViolation ? 'text-red-900 font-medium' : 'text-gray-900'}`}>
                                {event.title}
                              </p>
                              <p className={`text-sm ${isViolation ? 'text-red-700' : 'text-gray-600'} mt-0.5`}>
                                {formatEventDescription(event)}
                              </p>
                              {event.metadata?.location && (
                                <p className="text-xs text-gray-500 mt-1">
                                  📍 {event.metadata.location.lat.toFixed(6)}, {event.metadata.location.lng.toFixed(6)}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0 ml-4 text-right">
                              <p className="text-xs font-medium text-gray-900">
                                {timestamp.time}
                              </p>
                              <p className="text-xs text-gray-500">
                                {timestamp.relative}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing {history.length} events
          </span>
          <button
            type="button"
            onClick={fetchTrackerHistory}
            disabled={loading}
            className="text-blue-600 hover:text-blue-700 active:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-2 py-1"
            aria-label="Refresh tracker history"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
};

export default TrackerHistoryTimelineClean;
