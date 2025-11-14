import React, { useState, useEffect } from "react";
import axios from "axios";
import PageTitle from "../PageTitle";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ReportHeader from "../ReportHeader";
import logo from '../../assets/logo.png';
import { useAuth } from '../../contexts/AuthContext';
import provincialAgriculturistService from '../../services/provincialAgriculturistService';

const styles = {
  container: {
    backgroundColor: "#ffffff",
    padding: "2.5rem 3rem",
    borderRadius: "0.75rem",
    boxShadow: "0 6px 15px rgba(0,0,0,0.08)",
    border: "1px solid #e0e0e0",
    color: "#1e293b", // dark slate blue-gray
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    maxWidth: "900px",
    margin: "2rem auto",
  },
  notification: {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    backgroundColor: "#2563eb", // blue-600
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
    color: "#334155", // slate-700
    minWidth: "100px",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  input: {
    marginLeft: "0.5rem",
    border: "1.5px solid #cbd5e1", // slate-300
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#1e293b",
    outline: "none",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  },
  inputFocus: {
    borderColor: "#2563eb", // blue-600
    boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.3)",
  },
  errorBox: {
    marginBottom: "1.75rem",
    padding: "1rem 1.5rem",
    backgroundColor: "#fee2e2", // red-100
    color: "#b91c1c", // red-700
    borderRadius: "0.5rem",
    fontWeight: "600",
    fontSize: "1rem",
    border: "1px solid #fca5a5", // red-300
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loadingText: {
    fontStyle: "italic",
    fontSize: "1.1rem",
    color: "#64748b", // slate-500
    textAlign: "center",
    marginTop: "2.5rem",
  },
  button: {
    marginBottom: "2.5rem",
    padding: "0.75rem 1.75rem",
    backgroundColor: "#2563eb", // blue-600
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
    backgroundColor: "#94a3b8", // slate-400
    cursor: "not-allowed",
    boxShadow: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #cbd5e1", // slate-300
    fontSize: "1rem",
    marginBottom: "2rem",
  },
  th: {
    border: "1px solid #cbd5e1",
    padding: "0.75rem 1.25rem",
    textAlign: "left",
    backgroundColor: "#f1f5f9", // slate-100
    color: "#334155", // slate-700
    fontWeight: "700",
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  td: {
    border: "1px solid #e2e8f0", // slate-200
    padding: "0.75rem 1.25rem",
    color: "#475569", // slate-600
    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  noDataRow: {
    textAlign: "center",
    color: "#64748b", // slate-500
    fontStyle: "italic",
  },
  footer: {
    marginTop: "3rem",
    fontSize: "0.9rem",
    color: "#64748b", // slate-500
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

const FisherfolkReport = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fisherfolk, setFisherfolk] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const { user } = useAuth();
  const [notedBy, setNotedBy] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];

  const fetchFisherfolk = async () => {
    try {
      setLoading(true);
      setError(null);


      const response = await axios.get(
        "http://localhost:8000/api/fisherfolk/",
      );
      setFisherfolk(response.data);
      console.log("hey", response.data);
      setLoading(false);
    } catch {
      setError("Failed to fetch fisherfolk data.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFisherfolk();
  }, []);

  // Fetch provincial agriculturists to pick the one with position 'Agricultural Center Chief II'
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
        // ignore, fallback UI will show defaults
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
  logoImg.src = logo; // imported at top
  logoImg.onload = () => {
    // Title and date range below header (table will be placed below header via startY)
    const pw = doc.internal.pageSize.getWidth();
    const titleFontSize = 24;
    const titleY = headerHeight + 30;
    const dateY = titleY + titleFontSize + 6; // date sits below title
    doc.setFontSize(titleFontSize);
    doc.setFont("helvetica", "bold");
    doc.text("Fisherfolk Report", pw / 2, titleY, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      startDate && endDate
        ? `Date Range: ${startDate} to ${endDate}`
        : "Date Range: All Dates",
      margin,
      dateY
    );

    // Table starts below date range
    const tableStartY = dateY + 20;

    // Table
    const columns = [
      { header: "Name", dataKey: "name" },
      { header: "Municipality", dataKey: "municipality" },
      { header: "Barangay", dataKey: "barangay" },
      { header: "Date Added", dataKey: "date_added" },
    ];
    const rows = filteredFisherfolk.map((f) => ({
      name: `${f.first_name} ${f.last_name}`,
      municipality: f.address?.municipality || "-",
      barangay: f.address?.barangay || "-",
      date_added: formatDateTime(f.date_added),
    }));

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
        doc.text(
          `© ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`,
          data.settings.margin.left,
          doc.internal.pageSize.getHeight() - 20
        );
      },
    });
    const fileName = startDate && endDate
      ? `Fisherfolk_Report_${startDate}_to_${endDate}.pdf`
      : "Fisherfolk_Report.pdf";

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
      const marginRight = margin;
      const xRight = pw - marginRight;
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
            const opts = {
              suggestedName: fileName,
              types: [{ description: 'PDF file', accept: { 'application/pdf': ['.pdf'] } }],
            };
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

  // Filter fisherfolk based on date_added and selected date range
  const filteredFisherfolk = fisherfolk.filter(({ date_added }) => {
    if (!startDate || !endDate) return true;
    return date_added >= startDate && date_added <= endDate;
  });

  // pagination
  const totalF = filteredFisherfolk.length;
  const totalPages = Math.max(1, Math.ceil(totalF / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedFisherfolk = filteredFisherfolk.slice(startIdx, startIdx + pageSize);
  const thSticky = { ...styles.th, position: 'sticky', top: 0, zIndex: 10, backgroundColor: styles.th.backgroundColor || '#f1f5f9' };

  return (
    <div style={styles.container}>
      {showNotification && (
        <div style={styles.notification}>Downloading PDF...</div>
      )}
      <ReportHeader />
      <PageTitle value="Fisherfolk Report" />
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
        <p style={styles.loadingText}>Loading fisherfolk data...</p>
      ) : (
        <>
<button
  onClick={handleDownloadPDF}
  style={{
    ...styles.button,
    ...(filteredFisherfolk.length === 0 ? styles.buttonDisabled : {}),
  }}
  disabled={filteredFisherfolk.length === 0} // only disable if no data
>
  Download PDF
</button>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 14, color: '#334155' }}>Rows per page:</label>
                          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '6px 8px' }}>
                            {pageOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <div style={{ fontSize: 13, color: '#64748b' }}>Total: {totalF}</div>
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
                              <th style={thSticky}>Name</th>
                              <th style={thSticky}>Municipality</th>
                              <th style={thSticky}>Barangay</th>
                              <th style={thSticky}>Date Added</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedFisherfolk.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ ...styles.td, ...styles.noDataRow }}>
                                  No data available for selected date range.
                                </td>
                              </tr>
                            ) : (
                              paginatedFisherfolk.map(
                                ({ first_name, last_name, address, date_added }, index) => (
                                  <tr key={startIdx + index}>
                                    <td style={styles.td}>{`${first_name} ${last_name}`}</td>
                                    <td style={styles.td}>{address?.municipality || "-"}</td>
                                    <td style={styles.td}>{address?.barangay || "-"}</td>
                                    <td style={styles.td}>{formatDateTime(date_added)}</td>
                                  </tr>
                                )
                              ))}
                          </tbody>
                        </table>
                      </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <div style={{ textAlign: 'right', lineHeight: 1.4, color: '#334155' }}>
                <div><strong>Prepared by:</strong> {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—'}</div>
                <div>
                  <strong>Noted by:</strong>{' '}
                  {notedBy ? (
                    `${notedBy.first_name || ''} ${notedBy.middle_name ? notedBy.middle_name.charAt(0) + '. ' : ''}${notedBy.last_name || ''}`.trim()
                  ) : user && user.user_role === 'provincial_agriculturist' ? (
                    `${user.first_name || ''} ${user.middle_name ? user.middle_name.charAt(0) + '. ' : ''}${user.last_name || ''}`.trim()
                  ) : (
                    'Provincial Agriculturist'
                  )}{' '}
                  — {notedBy?.position || 'Agricultural Center Chief II'}
                </div>
                <div><strong>Date generated:</strong> {new Date().toLocaleDateString()}</div>
              </div>
            </div>
            <footer style={styles.footer}>
              &copy; {new Date().getFullYear()} Office of the Provincial
              Agriculturist - Fisheries Section.
            </footer>
          </div>
        </>
      )}
    </div>
  );
};

export default FisherfolkReport;
