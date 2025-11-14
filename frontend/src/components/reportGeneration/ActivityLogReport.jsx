import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageTitle from "../PageTitle";
import { getActivities } from "../../utils/activityLog";
import { useAuth } from '../../contexts/AuthContext';
import provincialAgriculturistService from '../../services/provincialAgriculturistService';
import logo from '../../assets/logo.png';

const styles = {
  container: {
    backgroundColor: "#ffffff",
    padding: "2.5rem 3rem",
    borderRadius: "0.75rem",
    boxShadow: "0 6px 15px rgba(0,0,0,0.08)",
    border: "1px solid #e0e0e0",
    color: "#1e293b",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "900px",
    margin: "2rem auto",
  },
  notification: {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    backgroundColor: "#2563eb",
    color: "#f9fafb",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
    zIndex: 50,
    fontWeight: "600",
    fontSize: "0.95rem",
    transition: "opacity 0.3s ease",
  },
  flexRow: {
    display: "flex",
    gap: "1.75rem",
    marginTop: "1.75rem",
    marginBottom: "2.5rem",
    alignItems: "center",
  },
  label: { fontWeight: "600", fontSize: "1rem", color: "#334155", minWidth: "100px" },
  input: {
    marginLeft: "0.5rem",
    border: "1.5px solid #cbd5e1",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    color: "#1e293b",
    outline: "none",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  },
  inputFocus: { borderColor: "#2563eb", boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.3)" },
  errorBox: {
    marginBottom: "1.75rem",
    padding: "1rem 1.5rem",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    borderRadius: "0.5rem",
    fontWeight: "600",
    fontSize: "1rem",
    border: "1px solid #fca5a5",
  },
  loadingText: { fontStyle: "italic", fontSize: "1.1rem", color: "#64748b", textAlign: "center", marginTop: "2.5rem" },
  button: {
    marginBottom: "2.5rem",
    padding: "0.75rem 1.75rem",
    backgroundColor: "#2563eb",
    color: "white",
    borderRadius: "0.5rem",
    cursor: "pointer",
    border: "none",
    fontWeight: "700",
    fontSize: "1.1rem",
    boxShadow: "0 6px 12px rgba(37, 99, 235, 0.5)",
  },
  buttonDisabled: { backgroundColor: "#94a3b8", cursor: "not-allowed", boxShadow: "none" },
  table: { width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", fontSize: "1rem", marginBottom: "2rem" },
  th: { border: "1px solid #cbd5e1", padding: "0.75rem 1.25rem", textAlign: "left", backgroundColor: "#f1f5f9", fontWeight: "700" },
  td: { border: "1px solid #e2e8f0", padding: "0.75rem 1.25rem", color: "#475569" },
  noDataRow: { textAlign: "center", color: "#64748b", fontStyle: "italic" },
  footer: { marginTop: "3rem", fontSize: "0.9rem", color: "#64748b", textAlign: "center" },
};

// Format timestamp for display
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return d.toLocaleString();
};

const ActivityLogReport = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const { user } = useAuth();
  const [notedBy, setNotedBy] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];
  const [searchQuery, setSearchQuery] = useState("");

  const fetchActivityLogs = async () => {
    setLoading(true);
    try {
      const logs = await getActivities();
      setActivityLogs(logs);
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
      setError("Failed to fetch activity log data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchProv = async () => {
      try {
        const resp = await provincialAgriculturistService.getAll();
        if (!mounted) return;
        const list = resp?.data || [];
        const match = list.find((p) => ((p.position || '').toString().toLowerCase().trim()) === 'agricultural center chief ii');
        if (match) setNotedBy(match);
      } catch (e) {
        // ignore
      }
    };
    fetchProv();
    return () => { mounted = false; };
  }, []);

  const handleDownloadPDF = () => {
    setShowNotification(true);

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const margin = 40;
    const logoWidth = 80;
    const logoHeight = 80;
    const headerHeight = 120;

    const logoImg = new Image();
    logoImg.src = logo;
    logoImg.onload = () => {
      // Title and date range below header (table will start below header)
      const pw = doc.internal.pageSize.getWidth();
      const titleFontSize = 24;
      const titleY = headerHeight + 30;
      const dateY = titleY + titleFontSize + 6;
      doc.setFontSize(titleFontSize);
      doc.setFont("helvetica", "bold");
      doc.text("System Activity Logs Report", pw / 2, titleY, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        startDate && endDate ? `Date Range: ${startDate} to ${endDate}` : "Date Range: All Dates",
        margin,
        dateY
      );

      const columns = [
      { header: "Date", dataKey: "date" },
      { header: "User", dataKey: "user" },
      { header: "Action", dataKey: "action" },
      { header: "Description", dataKey: "description" },
    ];

    const rows = activityLogs.map((log) => ({
      date: formatDateTime(log.timestamp),
      user: log.user || "-",
      action: log.action || "-",
      description: log.description || "-",
    }));

    const tableStartY = dateY + 20;
    autoTable(doc, {
    startY: tableStartY,
          head: [columns.map((col) => col.header)],
          body: rows.map((row) => columns.map((col) => row[col.dataKey])),
          styles: { font: "helvetica", fontSize: 10, cellPadding: 4 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          margin: { left: margin, right: margin },
          theme: "striped",
          didDrawPage: (data) => {
            // Only show header on the first page; footer shown on every page
            const pageNumber = doc.internal.getCurrentPageInfo ? doc.internal.getCurrentPageInfo().pageNumber : doc.internal.getNumberOfPages();
            if (pageNumber === 1) {
              try {
                doc.addImage(logoImg, "PNG", margin, 20, logoWidth, logoHeight);
              } catch (e) {}
              doc.setFontSize(16);
              doc.setFont("helvetica", "bold");
              doc.text(
                "Office of the Provincial Agriculturist - Fisheries Section",
                margin + logoWidth + 20,
                40,
                { maxWidth: doc.internal.pageSize.getWidth() - margin - logoWidth - 20 }
              );
              doc.setFontSize(10);
              doc.setFont("helvetica", "normal");
              const contactText =
                "Provincial Agriculturist Office, Aguila Road, Brgy. II\nCity of San Fernando, La Union 2500\nPhone: (072) 888-3184 / 607-4492 / 607-4488\nEmail: opaglaunion@yahoo.com";
              doc.text(contactText, margin + logoWidth + 20, 60, { maxWidth: 400 });
              doc.setLineWidth(1);
              doc.line(margin, headerHeight, doc.internal.pageSize.getWidth() - margin, headerHeight);
            }

            // Footer (draw on every page)
            doc.setFontSize(10);
            doc.text(
              `© ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`,
              data.settings.margin.left,
              doc.internal.pageSize.getHeight() - 20
            );
          },
        });

    const fileName =
      startDate && endDate ? `ActivityLog_Report_${startDate}_to_${endDate}.pdf` : "ActivityLog_Report.pdf";

    // add signature block on last page (bottom-right above footer)
    try {
      const preparedByName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—';
      const notedLabel = notedBy
        ? `${notedBy.first_name || ''} ${notedBy.last_name || ''}`.trim() + ` — ${notedBy.position || 'Agricultural Center Chief II'}`
        : `Provincial Agriculturist — Agricultural Center Chief II`;

      const lastPage = doc.internal.getNumberOfPages();
      doc.setPage(lastPage);
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 40;
      const xRight = pw - margin;
      let yPos = ph - 60;
      doc.setFontSize(10);
      doc.text(`Prepared by: ${preparedByName}`, xRight, yPos, { align: 'right' });
      yPos += 14;
      doc.text(`Noted by: ${notedLabel}`, xRight, yPos, { align: 'right' });
      yPos += 14;
      doc.text(`Date generated: ${new Date().toLocaleDateString()}`, xRight, yPos, { align: 'right' });

      // helper: save+preview PDF with File System Access API fallback
      const saveAndPreviewPdf = async (pdfDoc, fileName) => {
        const blob = pdfDoc.output('blob');
        if (window.showSaveFilePicker) {
          try {
            const opts = { suggestedName: fileName, types: [{ description: 'PDF file', accept: { 'application/pdf': ['.pdf'] } }] };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            const url = URL.createObjectURL(blob);
            const w = window.open(url);
            if (w) w.onload = () => w.print();
            return true;
          } catch (e) {
            return false;
          }
        }
        if (!window.confirm('Choose OK to download the PDF and open print preview, or Cancel to abort.')) return false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        const w = window.open(url);
        if (w) w.onload = () => w.print();
        return true;
      };

      (async () => {
        const ok = await saveAndPreviewPdf(doc, fileName);
        if (!ok) {
          setShowNotification(false);
          return;
        }
        setTimeout(() => setShowNotification(false), 2000);
      })();
    } catch (err) {
      setTimeout(() => setShowNotification(false), 2000);
    }
    };
  };

  // table pagination for UI
  const filteredActivityLogs = activityLogs.filter(({ timestamp }) => {
    if (!startDate || !endDate) return true;
    return timestamp >= startDate && timestamp <= endDate;
  });

  const searchedLogs = filteredActivityLogs.filter((log) => {
    const userStr = (log.user || "").toString().toLowerCase();
    const actionStr = (log.action || "").toString().toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return userStr.includes(q) || actionStr.includes(q);
  });

  const total = searchedLogs.length;
  const totalPagesUI = Math.max(1, Math.ceil(total / pageSize));
  const currentPageUI = Math.min(page, totalPagesUI);
  const startIdxUI = (currentPageUI - 1) * pageSize;
  const paginatedLogs = searchedLogs.slice(startIdxUI, startIdxUI + pageSize);
  const thSticky = { ...styles.th, position: 'sticky', top: 0, zIndex: 10, backgroundColor: styles.th.backgroundColor || '#f1f5f9' };

  return (
    <>
      <div className="px-6 pt-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin/utility')}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Back to utility"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <PageTitle value="ACTIVITY LOGS" />
            <p className="text-sm text-gray-600">View the activities done by users</p>
          </div>
        </div>

        <div className="pl-10 pr-10" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={styles.flexRow}>
        <div className="justify-right">
          <label style={styles.label}>Start Date:</label>
          <input
            type="date"
            style={styles.input}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = styles.inputFocus.borderColor)}
            onBlur={(e) => (e.target.style.borderColor = styles.input.borderColor)}
          />
        </div>
        <div>
          <label style={styles.label}>End Date:</label>
          <input
            type="date"
            style={styles.input}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onFocus={(e) => (e.target.style.borderColor = styles.inputFocus.borderColor)}
            onBlur={(e) => (e.target.style.borderColor = styles.input.borderColor)}
          />
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <p style={styles.loadingText}>Loading activity log data...</p>
      ) : (
        <>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 14, color: '#334155' }}>Rows per page:</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '6px 8px' }}>
                  {pageOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div style={{ fontSize: 13, color: '#64748b' }}>Total: {searchedLogs.length}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                  <label style={{ fontSize: 14, color: '#334155' }}>Search:</label>
                  <input
                    type="text"
                    placeholder="User or Action"
                    style={{ ...styles.input, padding: '6px 8px' }}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPageUI <= 1} style={{ padding: '6px 10px' }}>Prev</button>
                <div style={{ minWidth: 60, textAlign: 'center' }}>{currentPageUI} / {totalPagesUI}</div>
                <button onClick={() => setPage((p) => Math.min(totalPagesUI, p + 1))} disabled={currentPageUI >= totalPagesUI} style={{ padding: '6px 10px' }}>Next</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '60vh', borderRadius: 6 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={thSticky}>Date</th>
                    <th style={thSticky}>User</th>
                    <th style={thSticky}>Action</th>
                    <th style={thSticky}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...styles.td, ...styles.noDataRow }}>
                        No data available for selected date range.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log, idx) => (
                      <tr key={startIdxUI + idx}>
                        <td style={styles.td}>{formatDateTime(log.timestamp)}</td>
                        <td style={styles.td}>{log.user || "-"}</td>
                        <td style={styles.td}>{log.action || "-"}</td>
                        <td style={styles.td}>{log.description || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </>
      )}
      </div>
      </div>

      
    </>
  );
};

export default ActivityLogReport;