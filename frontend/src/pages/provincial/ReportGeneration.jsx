import React, { useEffect, useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/solid';
import PageTitle from '../../components/PageTitle';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { getSignatories } from '../../services/signatoriesService';
import { getFisherfolkReport, getBoatReport, getBoundaryViolationReport } from '../../services/reportService';

const ProvincialReportGeneration = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('Fisherfolk Report');
  const [filterBy, setFilterBy] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notedBy, setNotedBy] = useState(null);

  useEffect(() => {
    const loadSignatory = async () => {
      try {
        const data = await getSignatories({ is_active: true });
        const list = Array.isArray(data) ? data : (data?.results || []);
        const norm = (v = '') => String(v).toLowerCase().trim();
        const match = list.find(s => {
          const p = norm(s.position);
          return p === 'provincial agriculturist' || (p.includes('provincial') && p.includes('agriculturist')) || p === 'agricultural center chief ii';
        });
        if (match) setNotedBy(match);
      } catch (_) {}
    };
    loadSignatory();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (reportType === 'Fisherfolk Report') {
          const data = await getFisherfolkReport();
          setRows(Array.isArray(data) ? data : []);
        } else if (reportType === 'Boat Registry Report') {
          const data = await getBoatReport();
          setRows(Array.isArray(data) ? data : []);
        } else {
          const data = await getBoundaryViolationReport();
          let out = Array.isArray(data) ? data : [];
          if (filterBy) {
            const pendingSet = new Set(['Not Reported', 'Under Investigation']);
            if (filterBy === 'Pending Report') out = out.filter(x => pendingSet.has(String(x.report_status || x.status || '')));
            if (filterBy === 'Fisherfolk Reported') out = out.filter(x => String(x.report_status || x.status || '') === 'Fisherfolk Reported');
          }
          setRows(out);
        }
      } finally { setLoading(false); }
    };
    fetchData();
  }, [reportType, filterBy]);

  const buildColumnsAndRows = () => {
    if (reportType === 'Fisherfolk Report') {
      const cols = [
        { header: 'Registration #', dataKey: 'reg' },
        { header: 'Municipality', dataKey: 'municipality' },
        { header: 'Barangay', dataKey: 'barangay' },
        { header: 'Name', dataKey: 'name' },
        { header: 'Main Livelihood', dataKey: 'livelihood' },
      ];
      const body = rows.map(it => ({
        reg: it.registration_number || 'N/A',
        municipality: it.address?.municipality || 'N/A',
        barangay: it.address?.barangay || 'N/A',
        name: `${it.first_name || ''} ${it.middle_name || ''} ${it.last_name || ''}`.replace(/\s+/g,' ').trim(),
        livelihood: it.main_source_livelihood || 'N/A',
      }));
      return { cols, body };
    }
    if (reportType === 'Boat Registry Report') {
      const cols = [
        { header: 'MFBR #', dataKey: 'mfbr' },
        { header: 'Boat Name', dataKey: 'boat' },
        { header: 'Owner Name', dataKey: 'owner' },
        { header: 'Boat Type', dataKey: 'type' },
        { header: 'Tracker', dataKey: 'tracker' },
      ];
      const body = rows.map(it => {
        const ff = it.fisherfolk_registration_number;
        const owner = ff ? `${ff.first_name || ''} ${ff.middle_name || ''} ${ff.last_name || ''}`.replace(/\s+/g,' ').trim() : 'N/A';
        return {
          mfbr: it.mfbr_number || 'N/A',
          boat: it.boat_name || 'N/A',
          owner,
          type: it.type_of_boat || 'N/A',
          tracker: it.tracker ? 'Assigned' : 'Unassigned',
        };
      });
      return { cols, body };
    }
    const cols = [
      { header: 'MFBR #', dataKey: 'mfbr' },
      { header: 'Boat Name', dataKey: 'boat' },
      { header: 'Owner Name', dataKey: 'owner' },
      { header: 'From', dataKey: 'from' },
      { header: 'To', dataKey: 'to' },
      { header: 'Reason/Duration', dataKey: 'reason' },
      { header: 'Status', dataKey: 'status' },
    ];
    const body = rows.map(it => {
      const fisher = typeof it.fisherfolk === 'object' && it.fisherfolk
        ? `${it.fisherfolk.first_name || ''} ${it.fisherfolk.middle_name || ''} ${it.fisherfolk.last_name || ''}`.replace(/\s+/g,' ').trim()
        : (it.fisherfolk || 'N/A');
      return {
        mfbr: it.mfbr_number || 'N/A',
        boat: it.boat_name || 'N/A',
        owner: fisher,
        from: it.from_municipality || 'N/A',
        to: it.to_municipality || 'N/A',
        reason: it.dwell_duration ? `${Math.round(it.dwell_duration / 60)} min` : (it.reason || 'N/A'),
        status: it.report_status === 'Fisherfolk Reported' ? 'Fisherfolk Reported' : it.report_status === 'Resolved' ? 'Resolved' : 'Report Pending',
      };
    });
    return { cols, body };
  };

  const drawHeader = (doc, margin) => {
    const pw = doc.internal.pageSize.getWidth();
    let y = 40;
    const logoW = 80, logoH = 80, gap = 16;
    try { doc.addImage(logo, 'PNG', margin, y - 6, logoW, logoH); } catch(_) {}
    const textX = margin + logoW + gap;
    const textMaxW = pw - margin - textX;
    const title = 'Office of the Provincial Agriculturist - Fisheries Section';
    let titleSize = 20; doc.setFont('helvetica','bold');
    while (titleSize > 10) { doc.setFontSize(titleSize); if (doc.getTextWidth(title) <= textMaxW) break; titleSize -= 1; }
    doc.text(title, textX, y + 18);
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    const contact = [
      'Provincial Agriculturist Office, Aguila Road, Brgy. II',
      'City of San Fernando, La Union 2500',
      'Phone: (072) 888-3184 / 607-4492 / 607-4488',
      'Email: opaglaunion@yahoo.com'
    ];
    let ty = y + 34; contact.forEach((line, i) => doc.text(line, textX, ty + i * 12, { maxWidth: textMaxW }));
    const bottom = Math.max(y - 6 + logoH, ty + contact.length * 12) + 8;
    doc.setLineWidth(1); doc.line(margin, bottom, pw - margin, bottom);
    doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text(reportType, pw/2, bottom + 20, { align: 'center' });
    return bottom + 28;
  };

  const handleGenerate = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const margin = 40;
    const startY = drawHeader(doc, margin);
    const { cols, body } = buildColumnsAndRows();
    autoTable(doc, {
      startY,
      head: [cols.map(c => c.header)],
      body: body.map(r => cols.map(c => r[c.dataKey])),
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: margin, right: margin },
      theme: 'striped',
      didDrawPage: (data) => {
        doc.setFontSize(10);
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const leftX = data.settings.margin.left;
        const rightX = pageW - data.settings.margin.left;
        const footY = pageH - 20;
        doc.text(`  ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`, leftX, footY);
        doc.text(`Date generated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`, rightX, footY, { align: 'right' });
      }
    });

    // Signatories: Prepared by (Provincial user) + Noted by (Provincial Agriculturist)
    try {
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const colW = (pw - margin * 2) / 3;
      const x0 = margin; const x1 = margin + colW;
      const blockTop = ph - 120;
      const prepName = (user ? `${user.first_name || ''} ${user.middle_name ? user.middle_name.charAt(0)+'. ' : ''}${user.last_name || ''}` : '').replace(/\s+/g,' ').trim().toUpperCase();
      const prepRole = (user?.user_role || '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
      const prepTitle = `${prepRole}${user?.position ? ` - ${user.position}` : ''}` || 'Prepared by';
      const notedName = notedBy ? `${notedBy.first_name || ''} ${notedBy.middle_name ? notedBy.middle_name.charAt(0)+'. ' : ''}${notedBy.last_name || ''}`.replace(/\s+/g,' ').trim().toUpperCase() : '';
      const notedTitle = notedBy?.position || 'Provincial Agriculturist';
      const drawSig = (x, title, name) => { doc.setLineWidth(1); doc.line(x, blockTop + 40, x + colW - 20, blockTop + 40); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(name || ' ', x + (colW - 20)/2, blockTop + 54, { align:'center' }); doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(title, x + (colW - 20)/2, blockTop + 70, { align:'center' }); };
      drawSig(x0, prepTitle, prepName);
      drawSig(x1, notedTitle, notedName);
    } catch(_) {}

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) { w.onload = () => { try { w.focus(); w.print(); } catch(e){} }; }
  };

  return (
    <div className="p-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <PageTitle title="Report Generation" />
      <div className="mt-4 max-w-3xl bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Report</label>
            <select value={reportType} onChange={(e)=>{ setReportType(e.target.value); }} className="w-full px-3 py-2 border rounded">
              <option>Fisherfolk Report</option>
              <option>Boat Registry Report</option>
              <option>Boundary Violation Report</option>
            </select>
          </div>
          {reportType === 'Boundary Violation Report' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
              <select value={filterBy} onChange={(e)=>setFilterBy(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="">All</option>
                <option value="Pending Report">Pending Report</option>
                <option value="Fisherfolk Reported">Fisherfolk Reported</option>
              </select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <button onClick={handleGenerate} disabled={loading || rows.length===0} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50">
            <PrinterIcon className="w-5 h-5" />
            Generate Report
          </button>
          {rows.length===0 && !loading && (
            <span className="ml-3 text-sm text-gray-500">No data to print.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProvincialReportGeneration;

