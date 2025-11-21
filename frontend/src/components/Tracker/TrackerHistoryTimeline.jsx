import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown, ChevronUp, Activity, AlertTriangle, MapPin, Navigation, Anchor, Wifi, WifiOff, Check, Clock } from 'lucide-react';
import { apiClient } from '../../services/api_urls';

const TrackerHistoryTimeline = ({ trackerId, boatData, onClose, inline = false }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // all, violations, movements, status
  const [currentStatus, setCurrentStatus] = useState('unknown');
  const [lastReportedAt, setLastReportedAt] = useState(null);
  const lastReportedStatusRef = useRef(null);

  // Fetch on mount and filter change only
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

  const fetchTrackerHistory = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/tracker-history/${trackerId}/`, {
        params: { filter }
      });
      let data = Array.isArray(response.data) ? response.data : [];
      
      // Find the registration event timestamp
      const registrationEvent = data.find(e => e.event_type === 'registered');
      
      // If registration event exists, filter out events before registration
      if (registrationEvent) {
        const registrationTimestamp = new Date(registrationEvent.timestamp);
        data = data.filter(event => {
          const eventTimestamp = new Date(event.timestamp);
          // Keep events that are at or after registration time
          return eventTimestamp >= registrationTimestamp;
        });
      }
      
      // Determine most recent status event (only online/offline)
      const statusEvents = data.filter(e => ['online','offline'].includes(e.event_type))
                               .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (statusEvents.length > 0) {
        const newest = statusEvents[0];
        setCurrentStatus(newest.event_type);
        setLastReportedAt(newest.timestamp);
      } else {
        setCurrentStatus('unknown');
        setLastReportedAt(null);
      }
      setHistory(data);
    } catch (error) {
      console.error('Error fetching tracker history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType) => {
    const iconProps = { size: 20, className: "flex-shrink-0" };
    
    switch (eventType) {
      case 'online':
        return <Wifi {...iconProps} className="text-green-600" />;
      case 'offline':
        return <WifiOff {...iconProps} className="text-gray-500" />;
      case 'boundary_crossing':
        return <MapPin {...iconProps} className="text-blue-600" />;
      case 'violation':
        return <AlertTriangle {...iconProps} className="text-red-600" />;
      case 'idle':
        return <Anchor {...iconProps} className="text-orange-600" />;
      case 'registered':
        return <Check {...iconProps} className="text-green-600" />;
      default:
        return <Activity {...iconProps} className="text-gray-600" />;
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return { time: 'Unknown', relative: '', full: 'Unknown time' };
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
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
      return { time: 'Unknown', relative: '', full: 'Unknown time' };
    }
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'online': return 'bg-green-100 border-green-300';
      case 'offline': return 'bg-gray-100 border-gray-300';
      case 'boundary_crossing': return 'bg-blue-100 border-blue-300';
      case 'violation': return 'bg-red-100 border-red-300';
      case 'idle': return 'bg-orange-100 border-orange-300';
      case 'registered': return 'bg-green-100 border-green-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };


  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

const formatCoordinate = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toFixed(6);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return 'N/A';
};

  // Group events by date (newest events first within each day)
  const groupedHistory = React.useMemo(() => {
    const acc = {};
    (history || []).forEach((event) => {
      const dateKey = formatDate(event.timestamp);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
    });
    // Sort events within each date by timestamp (newest first)
    Object.keys(acc).forEach((dateKey) => {
      acc[dateKey].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
    return acc;
  }, [history]);

  const Wrapper = ({ children }) => {
    if (inline) {
      return (
        <div className="absolute top-4 right-4 z-30 p-0 pointer-events-auto">
          {children}
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-50 p-4">
        {children}
      </div>
    );
  };

  const Panel = ({ children }) => (
    <div 
      className={`bg-white ${inline ? 'rounded-2xl shadow-xl w-[360px] md:w-[420px] max-h-[80vh]' : 'rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:w-[520px] max-h-[85vh]'} flex flex-col ${inline ? '' : 'animate-slide-up'} mb-4`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  return (
    <Wrapper>
      <Panel>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">Tracker History</h2>
              <p className="text-sm text-gray-600 mt-1">Tracker #{trackerId}</p>
              {boatData?.mfbr_number && (
                <p className="text-sm font-medium text-blue-600 mt-0.5">
                  MFBR: {boatData.mfbr_number}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'violations', 'movements', 'status'].map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === filterOption
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 pb-28 md:pb-6 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
                <p className="text-sm text-gray-600">Loading history...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="bg-blue-50 rounded-full p-4 mb-4">
                <Clock size={48} className="text-blue-400" />
              </div>
              <p className="text-gray-900 font-semibold text-lg mb-2">No History Available</p>
              <p className="text-sm text-gray-600 mb-4 max-w-xs">
                This tracker hasn't recorded any events yet. History will appear here once the tracker becomes active and starts transmitting data.
              </p>
              <button
                onClick={fetchTrackerHistory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Activity size={16} />
                Refresh Now
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedHistory).map(([date, events], dateIndex) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="sticky top-0 bg-white z-10 pb-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {date}
                    </h3>
                  </div>

                  {/* Timeline Events */}
                  <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    {/* Events */}
                    <div className="space-y-4">
                      {events.map((event, eventIndex) => (
                        <div key={event.id || eventIndex} className="relative pl-12">
                          {/* Timeline Dot */}
                          <div className={`absolute left-0 top-1 w-9 h-9 rounded-full border-2 ${getEventColor(event.event_type)} flex items-center justify-center bg-white z-10`}>
                            {getEventIcon(event.event_type)}
                          </div>

                          {/* Event Card */}
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 text-sm">
                                {event.title || event.event_type.replace(/_/g, ' ').toUpperCase()}
                              </h4>
                              <span className="text-xs text-gray-500 font-medium whitespace-nowrap ml-2">
                                {formatTime(event.timestamp)}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-700 mb-2">
                              {event.description}
                            </p>

                            {/* Event Metadata */}
                            {event.metadata && (
                              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                                {event.metadata.location && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <MapPin size={14} className="mr-1.5 text-gray-400" />
                                    <span className="font-mono">
                                      {formatCoordinate(event.metadata.location.lat)}, {formatCoordinate(event.metadata.location.lng)}
                                    </span>
                                  </div>
                                )}
                                {event.metadata.from_municipality && event.metadata.to_municipality && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <Navigation size={14} className="mr-1.5 text-gray-400" />
                                    <span>
                                      {event.metadata.from_municipality} → {event.metadata.to_municipality}
                                    </span>
                                  </div>
                                )}
                                {event.metadata.duration && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    <Clock size={14} className="mr-1.5 text-gray-400" />
                                    <span>{event.metadata.duration}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Relative Time Badge */}
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white border border-gray-300 text-gray-700">
                                {formatTimestamp(event.timestamp).relative}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Stats */}
        {!loading && history.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Total Events: <strong className="text-gray-900">{history.length}</strong>
              </span>
              <button
                onClick={fetchTrackerHistory}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Activity size={16} />
                Refresh
              </button>
            </div>
          </div>
        )}
      </Panel>

      {!inline && (
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @media (max-width: 768px) {
          /* Ensure panel height accounts for mobile footers/safe area */
          .animate-slide-up {
            max-height: calc(100vh - 96px);
          }
        }
      `}</style>
      )}
    </Wrapper>
  );
};

export default TrackerHistoryTimeline;
