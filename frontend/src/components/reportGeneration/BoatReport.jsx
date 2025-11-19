import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageTitle from "../PageTitle";
import ReportHeader from "../ReportHeader";
import { useAuth } from "../../contexts/AuthContext";
import provincialAgriculturistService from "../../services/provincialAgriculturistService";
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
  label: {
    fontWeight: "600",
    fontSize: "1rem",
    color: "#334155",
    minWidth: "100px",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  input: {
    marginLeft: "0.5rem",
    border: "1.5px solid #cbd5e1",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#1e293b",
    outline: "none",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  },
  inputFocus: {
    borderColor: "#2563eb",
    boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.3)",
  },
  errorBox: {
    marginBottom: "1.75rem",
    padding: "1rem 1.5rem",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    borderRadius: "0.5rem",
    fontWeight: "600",
    fontSize: "1rem",
    border: "1px solid #fca5a5",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loadingText: {
    fontStyle: "italic",
    fontSize: "1.1rem",
    color: "#64748b",
    textAlign: "center",
    marginTop: "2.5rem",
  },
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
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    boxShadow: "0 6px 12px rgba(37, 99, 235, 0.5)",
    transition: "background-color 0.3s ease, box-shadow 0.3s ease",
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
    cursor: "not-allowed",
    boxShadow: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
    marginBottom: "2rem",
  },
  th: {
    border: "1px solid #cbd5e1",
    padding: "0.75rem 1.25rem",
    textAlign: "left",
    backgroundColor: "#f1f5f9",
    color: "#334155",
    fontWeight: "700",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  td: {
    border: "1px solid #e2e8f0",
    padding: "0.75rem 1.25rem",
    color: "#475569",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  noDataRow: {
    textAlign: "center",
    color: "#64748b",
    fontStyle: "italic",
  },
  footer: {
    marginTop: "3rem",
    fontSize: "0.9rem",
    color: "#64748b",
    textAlign: "center",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
};

// Format date utility
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return d.toLocaleString();
};

const BoatReport = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notedBy, setNotedBy] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];


  const fetchBoats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get("http://localhost:8000/api/boats/");
      setBoats(response.data);
      console.log("boat", response.data);
      setLoading(false);
    } catch {
      setError("Failed to fetch boat data.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoats();
  }, []);

  // Fetch provincial agriculturists and pick the one with the
  // position 'Agricultural Center Chief II' (case-insensitive)
  useEffect(() => {
    let mounted = true;
    const fetchProvincs = async () => {
      try {
        const resp = await provincialAgriculturistService.getAll();
        if (!mounted) return;
        const list = resp?.data || [];
        const match = list.find((p) => {
          const pos = (p.position || "").toString().toLowerCase().trim();
          return pos === "agricultural center chief ii";
        });
        if (match) setNotedBy(match);
      } catch (e) {
        // ignore — fallback UI will show default
      }
    };
    fetchProvincs();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownloadPDF = () => {
    setShowNotification(true);
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });
    const margin = 40;
    const logoWidth = 80;
    const logoHeight = 80;
    const headerHeight = 120;

    const logoImg = new Image();
    logoImg.src = logo;
    // Wait for image to load so it can be drawn on every page in didDrawPage
    logoImg.onload = () => {
    // Add report title and date-range below header
    const pw = doc.internal.pageSize.getWidth();
    const titleFontSize = 20; // make title appropriately bigger
    const titleY = headerHeight + 30;
    const dateY = titleY + titleFontSize + 6; // place date just below the title
    doc.setFontSize(titleFontSize);
    doc.setFont("helvetica", "bold");
    // centered large title
    doc.text("Boat Registry Report", pw / 2, titleY, { align: "center" });

    // date range follows under the title (left-aligned with margin)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      startDate && endDate ? `Date Range: ${startDate} to ${endDate}` : "Date Range: All Dates",
      margin,
      dateY
    );

    // Use the same columns and cell contents as the on-screen table
    const columns = [
      { header: "MFBR Number", dataKey: "mfbr_number" },
      { header: "Municipality", dataKey: "municipality" },
      { header: "Owner Name", dataKey: "owner_name" },
      { header: "Boat Name", dataKey: "boat_name" },
      { header: "Boat Type", dataKey: "boat_type" },
      { header: "Built Year", dataKey: "built_year" },
      { header: "Date Added", dataKey: "date_added" },
    ];

    const rows = filteredBoats.map((b) => ({
      mfbr_number: b.mfbr_number || "",
      municipality:
        b.fisherfolk?.address?.municipality || b.fisherfolk?.municipality || "N/A",
      owner_name: b.fisherfolk
        ? `${b.fisherfolk.first_name || ""} ${b.fisherfolk.middle_name ? b.fisherfolk.middle_name.charAt(0) + ". " : ""}${b.fisherfolk.last_name || ""}`.trim()
        : "N/A",
      boat_name: b.boat_name || "",
      // Keep the same boat_type string as displayed in the UI
      boat_type: b.boat_type || "",
      built_year: b.built_year || "",
      // Use the same date formatter as the UI so values match exactly
      date_added: formatDateTime(b.date_added),
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
            } catch (e) {
              // ignore image errors
            }
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
            // Divider
            doc.setLineWidth(1);
            doc.line(margin, headerHeight, doc.internal.pageSize.getWidth() - margin, headerHeight);
          }

          // Footer (draw on every page)
          doc.setFontSize(10);
          const pageW = doc.internal.pageSize.getWidth();
          const pageH = doc.internal.pageSize.getHeight();
          const leftX = data.settings.margin.left;
          const rightX = pageW - data.settings.margin.left;
          const footY = pageH - 20;
          doc.text(` Office of the Provincial Agriculturist - Fisheries Section.`, leftX, footY);
          doc.text(`Date generated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`, rightX, footY, { align: 'right' });
        },
      });
    // Open in a new tab and auto-print
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

  // Filter boats based on date_added and selected date range
  const filteredBoats = boats.filter(({ date_added }) => {
    if (!startDate || !endDate) return true;
    return date_added >= startDate && date_added <= endDate;
  });

  // pagination for the table only
  const totalBoats = filteredBoats.length;
  const totalPages = Math.max(1, Math.ceil(totalBoats / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedBoats = filteredBoats.slice(startIdx, startIdx + pageSize);

  // sticky header style helper
  const thSticky = { ...styles.th, position: 'sticky', top: 0, zIndex: 10, backgroundColor: styles.th.backgroundColor || '#f1f5f9' };

  return (
    <div style={styles.container}>
      {showNotification && (
        <div style={styles.notification}>Downloading PDF...</div>
      )}
      
      <ReportHeader />
      <PageTitle value="Boat Report" />
      <div style={styles.flexRow}>
        <div>
          <label style={styles.label}>Start Date:</label>
          <input
            type="date"
            style={styles.input}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onFocus={(e) =>
              (e.target.style.borderColor = styles.inputFocus.borderColor)
            }
            onBlur={(e) =>
              (e.target.style.borderColor = styles.input.borderColor)
            }
          />
        </div>
        <div>
          <label style={styles.label}>End Date:</label>
          <input
            type="date"
            style={styles.input}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onFocus={(e) =>
              (e.target.style.borderColor = styles.inputFocus.borderColor)
            }
            onBlur={(e) =>
              (e.target.style.borderColor = styles.input.borderColor)
            }
          />
        </div>
      </div>
      {error && <div style={styles.errorBox}>{error}</div>}
      {loading ? (
        <p style={styles.loadingText}>Loading boat data...</p>
      ) : (
        <>
          <button
            onClick={handleDownloadPDF}
            style={{
              ...styles.button,
              ...(!startDate || !endDate || filteredBoats.length === 0
                ? styles.buttonDisabled
                : {}),
            }}
            disabled={!startDate || !endDate || filteredBoats.length === 0}
          >
            Download PDF
          </button>
          <div>
            {/* pagination controls and scrollable table container */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 14, color: '#334155' }}>Rows per page:</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '6px 8px' }}>
                  {pageOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div style={{ fontSize: 13, color: '#64748b' }}>Total: {totalBoats}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ padding: '6px 10px' }}>Prev</button>
                <div style={{ minWidth: 60, textAlign: 'center' }}>{currentPage} / {totalPages}</div>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ padding: '6px 10px' }}>Next</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '60vh', borderRadius: 6 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={thSticky}>MFBR Number</th>
                    <th style={thSticky}>Municipality</th>
                    <th style={thSticky}>Owner Name</th>
                    <th style={thSticky}>Boat Name</th>
                    <th style={thSticky}>Boat Type</th>
                    <th style={thSticky}>Built Year</th>
                    <th style={thSticky}>Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBoats.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...styles.td, ...styles.noDataRow }}>
                        No data available for selected date range.
                      </td>
                    </tr>
                  ) : (
                    paginatedBoats.map((b, idx) => (
                      <tr key={b.mfbr_number || startIdx + idx}>
                        <td style={styles.td}>{b.mfbr_number}</td>
                        <td style={styles.td}>{b.fisherfolk?.address?.municipality || b.fisherfolk?.municipality || "N/A"}</td>
                        <td style={styles.td}>{b.fisherfolk ? `${b.fisherfolk.first_name || ""} ${b.fisherfolk.middle_name ? b.fisherfolk.middle_name.charAt(0) + ". " : ""}${b.fisherfolk.last_name || ""}`.trim() : "N/A"}</td>
                        <td style={styles.td}>{b.boat_name}</td>
                        <td style={styles.td}>{b.boat_type}</td>
                        <td style={styles.td}>{b.built_year}</td>
                        <td style={styles.td}>{formatDateTime(b.date_added)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <div style={{ textAlign: 'right', lineHeight: 1.4, color: '#334155' }}>
                <div><strong>Prepared by:</strong> {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—'}</div>
                <div>
                  <strong>Noted by:</strong>{' '}
                  {notedBy ? (
                    `${notedBy.first_name || ''} ${notedBy.middle_name[0] + "."|| ''} ${notedBy.last_name || ''}`.trim()
                  ) : user && user.user_role === 'provincial_agriculturist' ? (
                    `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim()
                  ) : (
                    'Provincial Agriculturist'
                  )}{' '}
                  — {notedBy?.position || 'Agricultural Center Chief II'}
                </div>
                <div><strong>Date generated:</strong> {new Date().toLocaleDateString()}</div>
              </div>
            </div>
            <footer style={styles.footer}>
              &copy; {new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.
            </footer>
          </div>
        </>
      )}
    </div>
  );
};

export default BoatReport;