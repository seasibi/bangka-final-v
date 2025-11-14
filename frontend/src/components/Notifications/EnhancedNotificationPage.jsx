import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, MapPin, Clock, User, Phone, FileText,
  Edit3, Save, X, CheckCircle, XCircle, History,
  ChevronDown, ChevronUp, Printer, Download
} from 'lucide-react';
import TrackerHistoryTimeline from '../Tracker/TrackerHistoryTimeline';
import './EnhancedNotificationPage.css';

/**
 * Enhanced Notification Page with Status Tracking and Role-Based Permissions
 * 
 * Features:
 * - Visual status indicator (Reported/Not Reported)
 * - Role-based editing (Municipal can edit, Admin/Provincial read-only)
 * - Audit log for status changes
 * - Integrated tracker history
 * - PDF report generation
 */
const EnhancedNotificationPage = ({ violationId, userRole }) => {
  const [violation, setViolation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedRemarks, setEditedRemarks] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showTrackerHistory, setShowTrackerHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Role-based permissions
  const canEdit = userRole === 'municipal_fishery_coordinator' || userRole === 'municipal_agriculturist';
  const isReadOnly = userRole === 'admin' || userRole === 'provincial_agriculturist';

  useEffect(() => {
    fetchViolationDetails();
    fetchAuditLogs();
  }, [violationId]);

  const fetchViolationDetails = async () => {
    try {
      setLoading(true);
      // API call to fetch violation details
      const response = await fetch(`/api/boundary-notifications/${violationId}/`);
      const data = await response.json();
      setViolation(data);
      setEditedRemarks(data.remarks || '');
      setEditedStatus(data.report_status || 'Not Reported');
    } catch (error) {
      console.error('Error fetching violation:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      // API call to fetch audit logs
      const response = await fetch(`/api/boundary-notifications/${violationId}/audit-log/`);
      const data = await response.json();
      setAuditLogs(data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const handleSaveChanges = async () => {
    if (!canEdit) return;

    try {
      const response = await fetch(`/api/boundary-notifications/${violationId}/update-status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_status: editedStatus,
          remarks: editedRemarks,
        }),
      });

      if (response.ok) {
        await fetchViolationDetails();
        await fetchAuditLogs();
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating violation:', error);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/boundary-notifications/${violationId}/generate-pdf/`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `violation-report-${violation.report_number}.pdf`;
      a.click();
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (loading) {
    return (
      <div className="enhanced-notification-loading">
        <div className="spinner"></div>
        <p>Loading violation details...</p>
      </div>
    );
  }

  if (!violation) {
    return (
      <div className="enhanced-notification-error">
        <AlertTriangle size={48} />
        <h3>Violation Not Found</h3>
        <p>The requested violation could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="enhanced-notification-page">
      {/* Header with Actions */}
      <div className="notification-header">
        <div className="header-title-section">
          <div className="violation-badge">
            <AlertTriangle size={24} />
            <span>Boundary Violation</span>
          </div>
          <h1 className="notification-title">
            Boat {violation.boat_id} Subject for Questioning
          </h1>
          <div className="notification-meta">
            <span className="meta-item">
              <Clock size={16} />
              {new Date(violation.created_at).toLocaleString()}
            </span>
            <span className="meta-item">
              <FileText size={16} />
              Report #{violation.report_number}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-icon" onClick={handlePrintReport} title="Print Report">
            <Printer size={20} />
          </button>
          <button className="btn-icon" onClick={handleDownloadPDF} title="Download PDF">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="status-card">
        <div className="status-header">
          <h3>Report Status</h3>
          {canEdit && !isEditing && (
            <button 
              className="btn-edit"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 size={16} />
              Edit Status
            </button>
          )}
        </div>

        <div className="status-content">
          {!isEditing ? (
            <>
              <div className={`status-indicator status-${editedStatus.toLowerCase().replace(' ', '-')}`}>
                {editedStatus === 'Fisherfolk Reported' ? (
                  <CheckCircle size={20} />
                ) : (
                  <XCircle size={20} />
                )}
                <span className="status-label">{editedStatus}</span>
              </div>

              <div className="remarks-section">
                <h4>Remarks</h4>
                <p className="remarks-text">
                  {editedRemarks || 'No remarks provided'}
                </p>
              </div>

              {isReadOnly && (
                <div className="readonly-notice">
                  <Info size={16} />
                  <span>You have read-only access to this information</span>
                </div>
              )}
            </>
          ) : (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="status-select">Report Status</label>
                <select
                  id="status-select"
                  value={editedStatus}
                  onChange={(e) => setEditedStatus(e.target.value)}
                  className="form-select"
                >
                  <option value="Not Reported">Not Reported</option>
                  <option value="Fisherfolk Reported">Fisherfolk Reported</option>
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="remarks-input">Remarks</label>
                <textarea
                  id="remarks-input"
                  value={editedRemarks}
                  onChange={(e) => setEditedRemarks(e.target.value)}
                  className="form-textarea"
                  rows={4}
                  placeholder="Enter remarks about the violation status..."
                />
              </div>

              <div className="edit-actions">
                <button 
                  className="btn-cancel"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedRemarks(violation.remarks || '');
                    setEditedStatus(violation.report_status || 'Not Reported');
                  }}
                >
                  <X size={16} />
                  Cancel
                </button>
                <button 
                  className="btn-save"
                  onClick={handleSaveChanges}
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Violation Details Card - Exact format as specified */}
      <div className="violation-details-card">
        <h3 className="card-title">Violation Details</h3>
        <div className="violation-content">
          <div className="boat-identifier">
            <div className="identifier-row">
              <span className="label">Boat Identifier:</span>
              <span className="value">Boat {violation.boat_id}</span>
            </div>
            <div className="identifier-row">
              <span className="label">Tracker Number:</span>
              <span className="value">{violation.tracker_number || '04567'}</span>
            </div>
            <div className="identifier-row">
              <span className="label">Report Number:</span>
              <span className="value">{violation.report_number}</span>
            </div>
          </div>

          {/* Exact text format from specification */}
          <div className="violation-description">
            <p>
              <strong>Boat {violation.boat_id}</strong>, owned by{' '}
              <strong>({violation.owner_name}), ({violation.registration_number})</strong>, is now subject to 
              questioning after the boat was observed idle for <strong>({violation.idle_minutes} mins)</strong> at{' '}
              <strong>({violation.timestamp_start})</strong> to <strong>({violation.timestamp_end})</strong> at 
              location <strong>({violation.longitude} and {violation.latitude})</strong>,{' '}
              <strong>({violation.current_municipality})</strong>, away from registered municipality{' '}
              <strong>({violation.registered_municipality})</strong>. An SMS notification has been sent immediately 
              to the fisherfolk's contact person, <strong>({violation.contact_person_name})</strong>, now being 
              subject to questioning. Monitoring continues for any movement or activity.
            </p>
          </div>
        </div>
      </div>

      {/* Tracker History Section */}
      <div className="tracker-history-card">
        <div 
          className="card-header-collapsible"
          onClick={() => setShowTrackerHistory(!showTrackerHistory)}
        >
          <h3>Tracker History & Movement Timeline</h3>
          {showTrackerHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {showTrackerHistory && violation.tracker_id && (
          <div className="tracker-history-content">
            <TrackerHistoryTimeline 
              trackerId={violation.tracker_id}
              isOpen={true}
              onClose={() => setShowTrackerHistory(false)}
            />
          </div>
        )}
      </div>

      {/* Audit Log Section */}
      <div className="audit-log-card">
        <div 
          className="card-header-collapsible"
          onClick={() => setShowAuditLog(!showAuditLog)}
        >
          <h3>
            <History size={20} />
            Audit Log
          </h3>
          {showAuditLog ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {showAuditLog && (
          <div className="audit-log-content">
            {auditLogs.length === 0 ? (
              <p className="no-logs">No status changes recorded yet</p>
            ) : (
              <div className="audit-timeline">
                {auditLogs.map((log, index) => (
                  <div key={index} className="audit-item">
                    <div className="audit-dot"></div>
                    <div className="audit-details">
                      <div className="audit-header">
                        <span className="audit-user">
                          <User size={14} />
                          {log.user_name} ({log.user_role})
                        </span>
                        <span className="audit-timestamp">
                          <Clock size={14} />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="audit-change">
                        Status changed: <strong>{log.old_status}</strong> → <strong>{log.new_status}</strong>
                      </div>
                      {log.remarks_changed && (
                        <div className="audit-remarks">
                          Remarks updated
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedNotificationPage;
