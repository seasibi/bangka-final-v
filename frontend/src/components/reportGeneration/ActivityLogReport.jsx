import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageTitle from "../PageTitle";
import { FaSearch } from "react-icons/fa";
import { getActivities } from "../../utils/activityLog";
import { useAuth } from '../../contexts/AuthContext';
import provincialAgriculturistService from '../../services/provincialAgriculturistService';
import logo from '../../assets/logo.png';
import Loader from "../Loader";

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
  const [statusFilter, setStatusFilter] = useState('all');

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

  const PaginationControls = ({ page, setPage, pageSize, total }) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <div className="hidden sm:flex items-center gap-1">
          {pages.slice(0, 10).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-2 py-1 rounded ${p === page ? 'bg-blue-600 text-white' : 'border'}`}
            >
              {p}
            </button>
          ))}
          {totalPages > 10 && <span className="px-2">...</span>}
        </div>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    );
  };
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
            } catch (e) { }
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

      // add signature block on last page (bottom-right above footer) and open in new tab
      const preparedByName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—';
      const notedLabel = notedBy
        ? `${notedBy.first_name || ''} ${notedBy.last_name || ''}`.trim() + ` — ${notedBy.position || 'Agricultural Center Chief II'}`
        : `Provincial Agriculturist — Agricultural Center Chief II`;

      const lastPage = doc.internal.getNumberOfPages();
      doc.setPage(lastPage);
      const pw2 = doc.internal.pageSize.getWidth();
      const ph2 = doc.internal.pageSize.getHeight();
      const marginRight = 40;
      const xRight = pw2 - marginRight;
      let yPos = ph2 - 60;
      doc.setFontSize(10);
      doc.text(`Prepared by: ${preparedByName}`, xRight, yPos, { align: 'right' });
      yPos += 14;
      doc.text(`Noted by: ${notedLabel}`, xRight, yPos, { align: 'right' });
      yPos += 14;
      doc.text(`Date generated: ${new Date().toLocaleDateString()}`, xRight, yPos, { align: 'right' });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        w.onload = () => {
          try { w.focus(); w.print(); } catch (e) {}
        };
      }
      setTimeout(() => setShowNotification(false), 2000);
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
    <div
      className="h-full bg-gray-50"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      <div className="h-full px-4 py-6">
        <div className="flex items-center gap-4">
          {/* back button */}
          <button type="button" onClick={() => navigate('/admin/utility')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 mt-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>BOUNDARY EDITOR</h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Manage the boundaries per municipalities of La Union
            </p>
          </div>
        </div>
        <div className="mb-8 ">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <div className="relative max-w-2xl">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="User or Action"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>




        <div className="bg-white rounded-lg shadow w-full font-montserrat p-4">
          {error && (
            <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">

                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-700">Rows per page:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="border border-blue-500 border-1 border-b-2 rounded px-2 py-1 text-sm"
                    >
                      {pageOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-gray-600">Total: {filteredActivityLogs.length}</div>
                    <label className="ml-4 text-sm text-gray-700">Status:</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-blue-500 border-1 border-b-2 rounded px-2 py-1 text-sm">
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPage((p) => Math.max(1, p - 1))
                    }
                    disabled={currentPageUI <= 1}
                    className="px-2 py-1 border border-blue-500 border-1 border-b-2 rounded disabled:opacity-50 text-sm"
                  >
                    Prev
                  </button>
                  <div className="text-sm text-gray-700">
                    {currentPageUI} / {totalPagesUI}
                  </div>
                  <button
                    onClick={() =>
                      setPage((p) =>
                        Math.min(totalPagesUI, p + 1)
                      )
                    }
                    disabled={currentPageUI >= totalPagesUI}
                    className="px-2 py-1 border border-blue-500 border-1 border-b-2 rounded disabled:opacity-50 text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[60vh] rounded-b">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="sticky top-0 z-10">
                    <tr
                      style={{
                        backgroundColor: "#3863CF",
                        fontFamily: "Montserrat, sans-serif",
                      }}
                    >
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          No data available for selected filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log, idx) => {
                        const rowIndex = startIdxUI + idx;
                        return (
                          <tr
                            key={rowIndex}
                            className={
                              rowIndex % 2 === 0
                                ? "bg-white"
                                : "bg-gray-50"
                            }
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDateTime(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.user || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.action || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.description || "-"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogReport;