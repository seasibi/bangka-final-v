import React, { useEffect, useMemo, useState } from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import jsPDF from 'jspdf'
import logo from '../assets/logo.png'
import { apiClient } from '../services/api_urls'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import provincialAgriculturistService from '../services/provincialAgriculturistService'

const formatReportNo = (id, createdAt) => {
  try {
    const d = createdAt ? new Date(createdAt) : new Date()
    const y = d.getFullYear()
    const pad = (n, w=4) => String(n).padStart(w, '0')
    return `RPT-${y}-${pad(id || 0)}`
  } catch {
    return `RPT-${new Date().getFullYear()}-${String(id||0).padStart(4,'0')}`
  }
}

const toFixedOrNA = (num, digits=5) => (Number.isFinite(Number(num)) ? Number(num).toFixed(digits) : 'N/A')

const downloadPdf = (n, generatedByName, notedBy) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const marginX = 48
  let y = 56
  const line = (txt, opts = {}) => {
    const { bold = false, size = 12, gap = 10 } = opts
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(String(txt), marginX, y, { maxWidth: 500 })
    y += gap + size
  }

  // Load logo then render PDF (fallback if image fails)
  const logoImg = new Image()
  let logoLoaded = false
  logoImg.onload = () => {
    logoLoaded = true
    renderPdf()
  }
  logoImg.onerror = () => {
    // proceed without logo
    renderPdf()
  }
  logoImg.src = logo

  function renderPdf() {
    // Header (with logo if available)
    if (logoLoaded) {
      const logoWidth = 80
      const logoHeight = 80
      doc.addImage(logoImg, 'PNG', marginX, 20, logoWidth, logoHeight)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(
        'Office of the Provincial Agriculturist - Fisheries Section',
        marginX + logoWidth + 20,
        40,
        { maxWidth: doc.internal.pageSize.getWidth() - marginX - logoWidth - 20 }
      )
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const contactText = 'Provincial Agriculturist Office, Aguila Road, Brgy. II\nCity of San Fernando, La Union 2500\nPhone: (072) 888-3184 / 607-4492 / 607-4488\nEmail: opaglaunion@yahoo.com'
      doc.text(contactText, marginX + logoWidth + 20, 60, { maxWidth: 400 })
      // Divider line after header
      const headerHeight = 120
      doc.setLineWidth(1)
      doc.line(marginX, headerHeight, doc.internal.pageSize.getWidth() - marginX, headerHeight)
      y = headerHeight + 20
    } else {
      // simple header fallback
      line('Boundary Violation Report', { bold: true, size: 18, gap: 8 })
      doc.setDrawColor(230); doc.line(marginX, y - 6, 560, y - 6)
      y += 6
    }

    // Meta
    line(`MFBR Number: ${n.mfbr_number || n.boat_name || 'N/A'}`, { bold: true })
    line(`Tracker Number: ${n.tracker_number || 'N/A'}`, { bold: true })
    line(`Report Number: ${formatReportNo(n.id, n.created_at)}`, { bold: true })
    y += 6

    // Body paragraph
    const mins = n.dwell_duration_minutes ?? Math.floor((n.dwell_duration || 0) / 60)
    const owner = n.fisherfolk_name || 'N/A'
    const lat = toFixedOrNA(n.current_lat)
    const lng = toFixedOrNA(n.current_lng)
    const municipality = n.to_municipality
    const boatIdent = n.mfbr_number || n.boat_name || `Boat ${n.boat?.boat_id || ''}`

    doc.setFont('helvetica','normal'); doc.setFontSize(12)
    const paragraph = `${boatIdent}, owned by ${owner}, is now being subjected to questioning due to being idle for ${mins} mins at the location (${lng}, ${lat}), ${municipality}. An SMS notification will be sent immediately to the boat owner (${owner}).`
    const split = doc.splitTextToSize(paragraph, 500)
    doc.text(split, marginX, y)
    y += 18 * split.length + 16

    // Signature block at bottom right
    const dateStr = new Date().toLocaleString()
    const notedLabel = notedBy
      ? `${notedBy.first_name || ''} ${notedBy.last_name || ''}`.trim() + ` — ${notedBy.position || 'Agricultural Center Chief II'}`
      : `Provincial Agriculturist — Agricultural Center Chief II`;
    
    // Position signature block at bottom right
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const rightMargin = 48
    const bottomMargin = 140
    let signatureY = pageHeight - bottomMargin
    
    doc.setFontSize(11)
    doc.text(`Prepared by: ${generatedByName || 'Ab\'Cd Ubungen'}`, pageWidth - rightMargin, signatureY, { align: 'right' })
    signatureY += 16
    doc.text(`Noted by: ${notedLabel}`, pageWidth - rightMargin, signatureY, { align: 'right' })
    signatureY += 16
    doc.text(`Date generated: ${dateStr}`, pageWidth - rightMargin, signatureY, { align: 'right' })
    signatureY += 6
    
    // Add signature line
    const lineStartX = pageWidth - rightMargin - 150
    const lineEndX = pageWidth - rightMargin
    signatureY += 10
    doc.setLineWidth(0.5)
    doc.line(lineStartX, signatureY, lineEndX, signatureY)
    signatureY += 12
    doc.setFontSize(9)
    doc.text('Signature', (lineStartX + lineEndX) / 2, signatureY, { align: 'center' })

    // Footer copyright (copied style)
    doc.setFontSize(10)
    doc.text(
      `© ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`,
      marginX,
      doc.internal.pageSize.getHeight() - 20
    )

    // Save
    doc.save(`${formatReportNo(n.id, n.created_at)}.pdf`)
  }

}

// Messenger-style notification list item
// Messenger-style notification list item
const NotificationListItem = ({ n, isSelected, onClick, isRead }) => {
  const boatName = n.mfbr_number || n.boat_name || `Boat ${n.boat || ''}`
  const time = useMemo(() => {
    try {
      const date = new Date(n.created_at)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    } catch {
      return ''
    }
  }, [n.created_at])

  const minutesIdle = n.dwell_duration_minutes ?? Math.floor((n.dwell_duration || 0) / 60)
  const showMonitor = true

  return (
    <div
      onClick={onClick}
      className={`flex items-center px-4 py-3 border-b border-gray-200 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : isRead ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/30 hover:bg-blue-50/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-medium text-gray-900 truncate ${!isRead ? 'font-bold' : ''}`}>{boatName}</p>
          <p className="text-xs text-gray-500 ml-2">{time}</p>
        </div>
        {showMonitor && (
          <div className="mt-2">
            <div className="flex items-center space-x-3">
              <span className="text-[11px] text-gray-500 w-10 text-right">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
              <span className="h-3 w-3 rounded-full bg-red-600 inline-block"></span>
              <span className="flex-1 h-0.5 bg-red-600/60"></span>
              <span className="text-xs text-red-700 font-medium truncate">
                Tracker has been idle for <span className="font-bold">{minutesIdle} minutes</span> at ({Number(n.current_lng).toFixed(5)}, {Number(n.current_lat).toFixed(5)})
              </span>
            </div>
          </div>
        )}
      </div>
      {!isRead && (
        <div className="ml-2 flex-shrink-0">
          <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
        </div>
      )}
      <ChevronRightIcon className="h-5 w-5 text-gray-400 ml-2 flex-shrink-0" />
    </div>
  )
}

// Messenger-style message detail view
const NotificationDetailView = ({ n, onDownload, user, notedBy, onSaved }) => {
  const reportNo = useMemo(() => formatReportNo(n.id, n.created_at), [n.id, n.created_at])
  const boatName = n.mfbr_number || n.boat_name || `Boat ${n.boat || ''}`
  const mins = n.dwell_duration_minutes ?? Math.floor((n.dwell_duration || 0) / 60)
  const owner = n.fisherfolk_name || 'N/A'
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reportStatus, setReportStatus] = useState(n.report_status || 'Not Reported')
  const [remarks, setRemarks] = useState(n.remarks || '')
  const isMunicipal = (user?.user_role || '').toLowerCase().includes('municipal')
  const wasReportedPersisted = String(n.report_status || '').toLowerCase() === 'fisherfolk reported'
  const canEdit = isMunicipal && !wasReportedPersisted
  const [audit, setAudit] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Map backend values -> UI labels
  const statusLabel = (val) => {
    const v = String(val || '').toLowerCase()
    // For the main status pill, treat 'Not Reported' as 'Report Pending' (default)
    if (v === 'not reported') return 'Report Pending'
    if (v === 'under investigation') return 'Report Pending'
    if (v === 'fisherfolk reported') return 'Fisherfolk Reported'
    if (v === 'resolved') return 'Resolved'
    return val || 'Not Reported'
  }

  // Reset local editable state whenever a different notification is selected
  useEffect(() => {
    setEditing(false)
    setSaving(false)
    setReportStatus(n.report_status || 'Not Reported')
    setRemarks(n.remarks || '')
    // Load audit trail for this violation
    const loadAudit = async () => {
      try {
        setAuditLoading(true)
        const res = await apiClient.get(`boundary-notifications/${n.id}/audit-log/`)
        setAudit(Array.isArray(res?.data) ? res.data : [])
      } catch (e) {
        setAudit([])
      } finally {
        setAuditLoading(false)
      }
    }
    if (n?.id) loadAudit()
  }, [n?.id, n?.report_status, n?.remarks])

  const saveStatus = async () => {
    try {
      setSaving(true)
      const res = await apiClient.patch(`boundary-notifications/${n.id}/update-status/`, {
        report_status: reportStatus,
        remarks: remarks || ''
      })
      setEditing(false)
      if (typeof onDownload === 'function' && n) {
        // no-op
      }
      if (typeof window?.dispatchEvent === 'function') {
        // can be used for global refresh hooks if needed
      }
      const updated = res?.data?.violation || { report_status: reportStatus, remarks }
      if (typeof onSaved === 'function') onSaved(updated)
      // Refresh audit timeline immediately
      try {
        const auditRes = await apiClient.get(`boundary-notifications/${n.id}/audit-log/`)
        setAudit(Array.isArray(auditRes?.data) ? auditRes.data : [])
      } catch (_) {}
    } catch (e) {
      console.error('Failed to update status', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-red-600 text-white px-6 py-4 shadow-md">
        <h2 className="text-lg font-bold">{boatName}</h2>
        <p className="text-sm text-red-100">Subjected for Questioning</p>
      </div>

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
          {/* Meta Information */}
          <div className="grid grid-cols-1 gap-3 text-sm border-b border-gray-200 pb-4">
            <div>
              <span className="font-semibold text-gray-700">MFBR Number:</span>
              <span className="ml-2 text-gray-900">{n.mfbr_number || 'N/A'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Tracker Number:</span>
              <span className="ml-2 text-gray-900">{n.tracker_number || 'N/A'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Report Number:</span>
              <span className="ml-2 text-gray-900">{reportNo}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Owner:</span>
              <span className="ml-2 text-gray-900">{owner}</span>
            </div>
          </div>

          {/* Main Message */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-800 leading-relaxed">
              <span className="font-semibold">{boatName}</span> is now being subjected to questioning due to being idle for <span className="font-semibold">{mins} minutes</span> at the location (<span className="font-mono text-xs">{toFixedOrNA(n.current_lng)}, {toFixedOrNA(n.current_lat)}</span>), <span className="font-semibold">{n.to_municipality}</span>.
            </p>
            <p className="text-sm text-gray-600 mt-3">
              An SMS notification will be sent immediately to the boat owner (<span className="font-semibold">{owner}</span>).
            </p>
          </div>

          {/* Timestamp */}
          <div className="text-xs text-gray-500 pt-2">
            {new Date(n.created_at).toLocaleString()}
          </div>

          {/* Report Status + Remarks + Timeline */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-sm">
              {/* Left: status and remarks */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-gray-700">Report Status:</span>
                  {!editing ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-200 text-green-800 font-medium">
                      {statusLabel(reportStatus)}
                    </span>
                  ) : (
                    <select
                      className="border rounded-md px-2 py-1 text-sm"
                      value={reportStatus}
                      onChange={(e)=>setReportStatus(e.target.value)}
                      disabled={!canEdit}
                    >
                      {/* Clean flow: default pending -> fisherfolk reported */}
                      <option value="Under Investigation">Report Pending</option>
                      <option value="Fisherfolk Reported">Fisherfolk Reported</option>
                    </select>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-gray-700">Remarks:</span>
                  {!editing ? (
                    <span className="text-gray-800">{remarks || '—'}</span>
                  ) : (
                    <>
                      <textarea
                        className="w-full border rounded-md px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                        rows={2}
                        value={remarks}
                        onChange={(e)=>setRemarks(e.target.value)}
                        placeholder={
                          reportStatus === 'Fisherfolk Reported'
                            ? 'Add final remarks'
                            : 'Add remarks while pending (e.g., not yet reported)'
                        }
                        disabled={!canEdit || !(['Fisherfolk Reported','Under Investigation','Not Reported'].includes(reportStatus))}
                      />
                    </>
                  )}
                </div>
                {canEdit && (
                  <div className="pt-2 flex gap-2">
                    {!editing ? (
                      <button
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm"
                        onClick={()=>setEditing(true)}
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm disabled:opacity-60"
                          disabled={saving}
                          onClick={saveStatus}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm"
                          onClick={()=>{ setEditing(false); setReportStatus(n.report_status || 'Not Reported'); setRemarks(n.remarks || '') }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Right: status timeline */}
              <div className="md:pl-4">
                <div className="rounded-md border border-gray-200 bg-white">
                  <div className="px-3 py-2 border-b bg-blue-50 text-blue-800 font-semibold text-sm rounded-t-md">Report Tracking</div>
                  <div className="p-3">
                    <ul className="space-y-3">
                      {/* Generated */}
                      <li className="flex items-start gap-3">
                        <span className="text-[11px] text-gray-500 w-24 text-right leading-5">{new Date(n.created_at).toLocaleDateString()}</span>
                        <span className="mt-1 h-3 w-3 rounded-full bg-blue-600 inline-block"></span>
                        <span className="text-xs text-gray-800 font-medium">Report Generated</span>
                      </li>
                      {/* Status changes from audit (with remarks) */}
                      {auditLoading ? (
                        <li className="text-xs text-gray-500">Loading timeline…</li>
                      ) : (
                        [...(audit || [])]
                          .sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp))
                          .map((log, idx) => {
                            const label = statusLabel(log.new_status)
                            const dotClass = label === 'Fisherfolk Reported' ? 'bg-green-600' : label === 'Report Pending' ? 'bg-red-600' : 'bg-gray-400'
                            return (
                              <li key={log.id || idx} className="flex items-start gap-3">
                                <span className="text-[11px] text-gray-500 w-24 text-right leading-5">{new Date(log.timestamp).toLocaleDateString()}</span>
                                <span className={`mt-1 h-3 w-3 rounded-full inline-block ${dotClass}`}></span>
                                <div className="text-xs text-gray-800">
                                  <span className="font-medium">{label}</span>
                                  {log.new_remarks ? (
                                    <span className="text-gray-600"> — {log.new_remarks}</span>
                                  ) : null}
                                </div>
                              </li>
                            )
                          })
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* signature block moved to bottom-right above footer */}
        </div>
      </div>

      {/* Footer with Print Button */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <button
          onClick={() => onDownload(n)}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V4a2 2 0 012-2h8a2 2 0 012 2v5M6 14h12M6 18h8M6 10h12" />
          </svg>
          Print Report
        </button>
      </div>
    </div>
  )
}

const Notifications = () => {
  const { notifications, fetchNotifications, markAsRead, unreadCount } = useNotifications()
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [allNotifications, setAllNotifications] = useState([])
  const { user } = useAuth()
  const [notedBy, setNotedBy] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})

  useEffect(() => {
    let mounted = true
    const fetchProv = async () => {
      try {
        const resp = await provincialAgriculturistService.getAll()
        if (!mounted) return
        const list = resp?.data || []
        const match = list.find((p) => ((p.position || '').toString().toLowerCase().trim()) === 'agricultural center chief ii')
        if (match) setNotedBy(match)
      } catch (e) {
        // ignore
      }
    }
    fetchProv()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // Fetch all notifications (both read and unread)
    const loadNotifications = async () => {
      await fetchNotifications({})
    }
    loadNotifications()
  }, [])

  // Auto-refresh every 10s to pick up newly seeded reports
  useEffect(() => {
    const id = setInterval(() => {
      fetchNotifications({})
    }, 10000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    // No grouping: every notification is its own row. Sort by violation day first.
    const ts = (n) => new Date(n.violation_timestamp || n.status_updated_at || n.created_at || 0).getTime()
    const list = [...(notifications || [])].sort((a,b)=> ts(b) - ts(a))
    setAllNotifications(list)
    if (list.length > 0 && (!selectedNotification || !list.find(x => x.id === selectedNotification.id))) {
      handleSelectNotification(list[0])
    }
  }, [notifications])

  // Build grouped view for sidebar (by mfbr_number primarily)
  const grouped = useMemo(() => {
    const ts = (n) => new Date(n.violation_timestamp || n.status_updated_at || n.created_at || 0).getTime()
    const map = new Map()
    for (const n of allNotifications) {
      const key = n.mfbr_number || n.boat_name || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(n)
    }
    // sort items within group (latest first)
    const groups = Array.from(map.entries()).map(([key, items]) => ({
      key,
      title: `${key} Location Update`,
      items: items.sort((a,b)=> ts(b)-ts(a))
    }))
    // sort groups by latest item timestamp
    groups.sort((a,b)=>{
      const at = a.items[0] ? ts(a.items[0]) : 0
      const bt = b.items[0] ? ts(b.items[0]) : 0
      return bt - at
    })
    return groups
  }, [allNotifications])

  const handleSelectNotification = async (notification) => {
    setSelectedNotification(notification)
    
    // Auto-mark as read when opened
    if (notification.status === 'pending' && !notification.read_at) {
      try {
        await markAsRead(notification.id)
        // Update local state to reflect read_at instead of changing status
        setAllNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)
        )
      } catch (error) {
        console.error('Failed to mark as read:', error)
      }
    }
  }

  const handlePrint = async (n) => {
    try {
      const boatName = n.mfbr_number || n.boat_name || `Boat ${n.boat || ''}`
      const mins = n.dwell_duration_minutes ?? Math.floor((n.dwell_duration || 0) / 60)
      const owner = n.fisherfolk_name || 'N/A'
      const boatProperName = n.boat_name || n.boat || ''
      const contactPersonName = (
        n.contact_person_full_name ||
        n.contact_full_name ||
        n.emergency_contact_full_name ||
        n.emergency_contact_name ||
        n.fisherfolk_contact_person_name ||
        n.contact_person_name ||
        n.contact_name ||
        n.fisherfolk_contact_person ||
        ''
      )
      const contactPersonNumber = (
        n.contact_person_number ||
        n.contact_number ||
        n.contact_mobile ||
        n.fisherfolk_contact_number ||
        n.fisherfolk_contact_person_number ||
        ''
      )
      const lat = Number(n.current_lat).toFixed(5)
      const lng = Number(n.current_lng).toFixed(5)
      const created = new Date(n.created_at).toLocaleString()
      const status = (n.report_status || 'Not Reported')
      const dateShort = (()=>{ const d=new Date(); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yy=d.getFullYear(); return `${dd}/${mm}/${yy}` })()
      const trackerNo = n.tracker_number || 'N/A'
      const reportNo = (()=>{ try{ const d=new Date(n.created_at); return `RPT-${d.getFullYear()}-${String(n.id||0).padStart(4,'0')}`}catch(_){ return `RPT-${String(n.id||0).padStart(4,'0')}`}})()

      const dwellSecs = Number.isFinite(Number(n.dwell_duration)) ? Number(n.dwell_duration) : ((Number(n.dwell_duration_minutes) || 0) * 60)
      const idleStartDt = new Date(n.violation_timestamp || n.created_at)
      const idleEndDt = new Date(idleStartDt.getTime() + (dwellSecs * 1000))
      const idleStartStr = idleStartDt.toLocaleString()
      const idleEndStr = idleEndDt.toLocaleString()

      const html = `<!doctype html><html><head>
        <meta charset="utf-8"/>
        <title>Boundary Violation Report - ${boatName}</title>
        <style>
          @page { size: A4; margin: 15mm }
          html, body { height: 100%; }
          body{font-family: Arial, Helvetica, sans-serif; color:#111827; margin:0; -webkit-print-color-adjust: exact; print-color-adjust: exact}
          .page{ width: 210mm; margin: 0 auto; padding: 0 0 10mm 0; box-sizing: border-box }
          .header-wrap{display:flex;align-items:center;gap:16px}
          .logo{width:84px;height:84px;object-fit:contain}
          .hdr-title{font-size:22px;font-weight:800;color:#1f2937}
          .hdr-sub{color:#374151;line-height:1.4;font-size:12px}
          .spacer{height:16px}
          .meta{margin-top:16px}
          .meta .row{margin:3px 0}
          .meta .label{font-weight:700}
          .bodyp{margin-top:16px;line-height:1.75;color:#111827}
          .bodyp strong{font-weight:700}
          .shot{margin-top:18px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden}
          #map{width:100%;height:300px}
          .sign{display:flex;justify-content:space-between;margin-top:28px}
          .sign .col{width:48%}
          .sign .cap{font-size:12px;color:#374151;margin-bottom:28px}
          .line{border-top:1px solid #111827;margin-top:40px}
          .roles{display:flex;gap:6px;align-items:center;color:#374151;font-size:12px;margin-top:6px}
          .footer{margin-top:26px;border-top:1px solid #e5e7eb;padding-top:8px;color:#6b7280;font-size:12px;display:flex;justify-content:space-between}
          @media print{button{display:none}}
          /* Leaflet print fixes */
          .leaflet-container{background:#fff !important}
        </style>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
      </head><body>
        <div class="page">
        <div class="header-wrap">
          <img class="logo" src="${logo}" alt="logo" />
          <div>
            <div class="hdr-title">Office of the Provincial Agriculturist - Fisheries Section</div>
            <div class="hdr-sub">
              Provincial Agriculturist Office, Aguila Road, Brgy. II<br/>
              City of San Fernando, La Union 2500<br/>
              Phone: (072) 888-3184 / 607-4492 / 607-4488<br/>
              Email: opaglaunion@yahoo.com
            </div>
          </div>
        </div>
        <div class="spacer"></div>

        <div class="meta">
          <div class="row"><span class="label">MFBR Number:</span> ${boatName}</div>
          <div class="row"><span class="label">Boat Name:</span> ${boatProperName || 'N/A'}</div>
          <div class="row"><span class="label">Tracker Number:</span> ${trackerNo}</div>
          <div class="row"><span class="label">Report Number:</span> ${reportNo}</div>
          <div class="row"><span class="label">Contact Person:</span> ${contactPersonName || 'N/A'}</div>
          <div class="row"><span class="label">Contact Number:</span> ${contactPersonNumber || 'N/A'}</div>
          <div class="row"><span class="label">Idle Start:</span> ${idleStartStr}</div>
          <div class="row"><span class="label">Idle End:</span> ${idleEndStr}</div>
        </div>

        <p class="bodyp">
          ${boatName}${boatProperName ? ` (${boatProperName})` : ''}, owned by <strong>${owner}</strong>, is now subject to questioning after the boat
          was observed idle for <strong>${mins} mins</strong> from <strong>${idleStartStr}</strong> to <strong>${idleEndStr}</strong> at location <strong>(${lng}, ${lat})</strong>,
          <strong>${n.to_municipality}</strong>, away from registered municipality <strong>${n.from_municipality || ''}</strong>. An SMS notification has been sent immediately to the
          fisherfolk’s contact person, <strong>${contactPersonName || 'N/A'}</strong>, now being subject to questioning. Monitoring continues for any movement or activity.
        </p>

        <div class="shot"><div id="map"></div></div>

        <div class="sign">
          <div class="col">
            <div class="cap">Prepared by:</div>
            <div class="line"></div>
            <div class="roles">Municipal Agriculturist&nbsp;&nbsp;or&nbsp;&nbsp;Provincial Agriculturist</div>
          </div>
          <div class="col">
            <div class="cap">Noted by:</div>
            <div class="line"></div>
            <div class="roles">Provincial Agriculturist</div>
          </div>
        </div>

        <div class="footer"><span>© ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.</span><span>Date Generated: ${dateShort}</span></div>
        <button onclick="window.print()" style="margin-top:16px;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff">Print</button>
        </div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <script>
          (function(){
            var lat=${lat}, lng=${lng};
            var m = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat,lng], 13);
            var tl = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
            tl.addTo(m);
            var marker = L.marker([lat,lng]).addTo(m);
            var printed = false;
            tl.on('load', function(){ if (printed) return; printed = true; setTimeout(function(){ try { window.focus(); window.print(); } catch(e){} }, 400); });
            // Fallback print if tiles fail
            setTimeout(function(){ if (!printed) { try { window.focus(); window.print(); } catch(e){} } }, 2500);
          })();
        </script>
      </body></html>`

      const w = window.open('', '_blank')
      if (!w) return
      w.document.write(html)
      w.document.close()
    } catch(e) {
      console.error('Print failed', e)
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"  style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Left Sidebar - Notification List */}
      <div className="w-96 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={() => fetchNotifications({})}
            title="Refresh"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 4v6h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 15A9 9 0 1 1 17 4.51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Refresh
          </button>
        </div>

        {/* Notification List (Grouped) */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No notifications</div>
          ) : (
            grouped.map(group => {
              const latest = group.items[0]
              const showAll = !!expandedGroups[group.key]
              const visible = showAll ? group.items : group.items.slice(0, 3)
              return (
                <div key={group.key} className="border-b border-gray-200">
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => latest && handleSelectNotification(latest)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
                      <span className="text-sm font-semibold text-gray-800 truncate">{group.title}</span>
                    </div>
                    <span className="text-gray-400">V</span>
                  </div>

                  {/* Group items */}
                  <div className="px-4 py-2 space-y-2">
                    {visible.map((n, idx) => {
                      const isLatest = idx === 0
                      const minutesIdle = n.dwell_duration_minutes ?? Math.floor((n.dwell_duration || 0) / 60)
                      const t = new Date(n.violation_timestamp || n.status_updated_at || n.created_at)
                      const isFisherReported = (n.report_status || '').toLowerCase() === 'fisherfolk reported'
                      return (
                        <div
                          key={n.id}
                          className={`flex items-center gap-3 py-1 cursor-pointer ${selectedNotification?.id === n.id ? 'bg-blue-50 rounded-md px-2' : ''}`}
                          onClick={() => handleSelectNotification(n)}
                        >
                          <span className="text-[11px] text-gray-500 w-12 text-right leading-5">{t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          <span className={`${isFisherReported ? (isLatest ? 'h-3 w-3 bg-gray-500' : 'h-2 w-2 bg-gray-400') : (isLatest ? 'h-3 w-3 bg-red-600' : 'h-2 w-2 bg-red-400')} rounded-full inline-block`}></span>
                          <span className={`flex-1 h-0.5 ${isFisherReported ? (isLatest ? 'bg-gray-500/60' : 'bg-gray-300/50') : (isLatest ? 'bg-red-600/60' : 'bg-red-300/50')}`}></span>
                          <span className={`text-xs truncate ${isFisherReported ? (isLatest ? 'text-gray-700 font-semibold' : 'text-gray-500') : (isLatest ? 'text-red-700 font-semibold' : 'text-red-500')}`}>
                            Tracker has been idle for <span className="font-bold">{minutesIdle} minutes</span> at ({Number(n.current_lng).toFixed(5)}, {Number(n.current_lat).toFixed(5)})
                          </span>
                        </div>
                      )
                    })}

                    {group.items.length > 3 && (
                      <button
                        className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                      >
                        {showAll ? 'Show less' : `Show all (${group.items.length})`}
                      </button>
                    )}
                    {!showAll && group.items.length > visible.length && (
                      <div className="text-[11px] text-gray-400">+ {group.items.length - visible.length} more…</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Side - Message Detail */}
      <div className="flex-1 flex flex-col">
        {selectedNotification ? (
          <NotificationDetailView
            n={selectedNotification}
            onDownload={handlePrint}
            user={user}
            notedBy={notedBy}
            onSaved={(updated) => {
              // Merge into selected & refresh list from server
              setSelectedNotification(prev => prev ? { ...prev, ...updated } : prev)
              fetchNotifications({})
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-4 text-sm">Select a notification to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Notifications