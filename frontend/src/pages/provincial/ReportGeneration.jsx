import React, { useEffect, useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/solid';
import Loader from '../../components/Loader';
import ReportHeader from '../../components/ReportHeader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { getSignatories } from '../../services/signatoriesService';
import { getFisherfolkReport, getBoatReport, getBoundaryViolationReport } from '../../services/reportService';

const ProvincialReportGeneration = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('Fisherfolk Report');
  const [groupBy, setGroupBy] = useState(['Municipality']);
  const [sortBy, setSortBy] = useState('Ascending');
  const [filterBy, setFilterBy] = useState('');
  const [rows, setRows] = useState([]);
  const [processedData, setProcessedData] = useState([]);
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

  useEffect(() => {
    if (!rows || rows.length === 0) { setProcessedData([]); return; }
    let filtered = [...rows];
    if (reportType === 'Boundary Violation Report' && filterBy) {
      const pendingSet = new Set(['Not Reported', 'Under Investigation']);
      if (filterBy === 'Pending Report') filtered = filtered.filter(i => pendingSet.has(String(i.report_status || i.status || '')));
      else if (filterBy === 'Fisherfolk Reported') filtered = filtered.filter(i => String(i.report_status || i.status || '') === 'Fisherfolk Reported');
    }
    const first = groupBy[0];
    const getFirstGroupValue = (item) => {
      if (!first) return '';
      if (reportType === 'Fisherfolk Report') {
        if (first === 'Municipality') return item.address?.municipality || '';
        if (first === 'Barangay') return item.address?.barangay || '';
        if (first === 'Name') return `${item.first_name || ''} ${item.last_name || ''}`;
        if (first === 'Registration Number') return item.registration_number || '';
      } else if (reportType === 'Boat Registry Report') {
        if (first === 'Municipality') return item.fisherfolk_registration_number?.address?.municipality || '';
        if (first === 'MFBR Number') return item.mfbr_number || '';
        if (first === 'Boat Name') return item.boat_name || '';
        if (first === 'Owner Name') {
          const ff = item.fisherfolk_registration_number; return ff ? `${ff.first_name || ''} ${ff.last_name || ''}` : '';
        }
      } else if (reportType === 'Boundary Violation Report') {
        if (first === 'Municipality') return item.from_municipality || '';
        if (first === 'MFBR Number') return item.mfbr_number || '';
        if (first === 'Boat Name') return item.boat_name || '';
        if (first === 'Owner Name') {
          const ff = item.fisherfolk; if (typeof ff === 'object' && ff) { return `${ff.first_name || ''} ${ff.last_name || ''}`.trim(); }
          return ff || '';
        }
        if (first === 'Status') return item.report_status || item.status || '';
        if (first === 'Reason') return item.reason || '';
      }
      return '';
    };
    if (sortBy === 'Ascending') {
      filtered.sort((a,b) => { const av = getFirstGroupValue(a); const bv = getFirstGroupValue(b); return typeof av === 'string' ? av.localeCompare(bv) : av - bv; });
    } else {
      filtered.sort((a,b) => { const av = getFirstGroupValue(a); const bv = getFirstGroupValue(b); return typeof av === 'string' ? bv.localeCompare(av) : bv - av; });
    }
    setProcessedData(filtered);
  }, [rows, groupBy, sortBy, filterBy, reportType]);

  const buildColumnsAndRows = () => {
    if (reportType === 'Fisherfolk Report') {
      const cols = [
        { header: 'Registration #', dataKey: 'reg' },
        { header: 'Municipality', dataKey: 'municipality' },
        { header: 'Barangay', dataKey: 'barangay' },
        { header: 'Name', dataKey: 'name' },
        { header: 'Main Livelihood', dataKey: 'livelihood' },
      ];
      const body = processedData.map(it => ({
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
      const body = processedData.map(it => {
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
    const body = processedData.map(it => {
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

  const reportOptions = ['Fisherfolk Report', 'Boat Registry Report', 'Boundary Violation Report'];
  const groupByOptions = ['Municipality', 'Barangay', 'Name', 'Registration Number', 'MFBR Number', 'Boat Name', 'Owner Name', 'Status', 'Reason'];
  const sortByOptions = ['Ascending', 'Descending'];
  const filterByOptions = ['Pending Report', 'Fisherfolk Reported'];

  const addGroupBy = () => {
    const opts = groupByOptions.filter(opt => !groupBy.includes(opt));
    if (opts.length > 0 && groupBy.length < 3) setGroupBy([...groupBy, opts[0]]);
  };

  const removeGroupBy = (index) => {
    if (groupBy.length > 1) {
      setGroupBy(groupBy.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="px-6 py-6">
        <div className="flex justify-between items-center">
          <div className="grid grid-cols-1 grid-rows-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-3">REPORT GENERATION</h1>
            <p className="text-gray-700">Generate reports, start with selecting report type</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-1">
            <div className="bg-gray-100 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Sorting Pane</h3>
              <p className="text-sm text-gray-600 mb-6">Sort the data you need</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Report</label>
                <select
                  value={reportType}
                  onChange={(e)=>{ setReportType(e.target.value); setGroupBy(['Municipality']); setFilterBy(''); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {reportOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Group by:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={addGroupBy}
                      disabled={groupBy.length>=3}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                      title="Add grouping"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5v14m7-7H5"/></svg>
                    </button>
                    <button
                      onClick={()=>removeGroupBy(groupBy.length-1)}
                      disabled={groupBy.length<=1}
                      className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Remove grouping"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14"/></svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {groupBy.map((group, idx)=> (
                    <select
                      key={idx}
                      value={group}
                      onChange={(e)=>{
                        const ng=[...groupBy];
                        ng[idx]=e.target.value;
                        setGroupBy(ng);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {groupByOptions.concat(group).map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                    </select>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e)=>setSortBy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {sortByOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>

              {reportType === 'Boundary Violation Report' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by:</label>
                  <select
                    value={filterBy}
                    onChange={(e)=>setFilterBy(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {filterByOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || processedData.length===0}
                className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <PrinterIcon className="w-5 h-5" />
                Generate Report
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              {loading ? (
                <div className="flex justify-center items-center py-20"><Loader /></div>
              ) : (
                <>
                  <ReportHeader />
                  <h2 className="text-2xl font-bold text-center my-6">{reportType}</h2>
                  {processedData.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p>No data available for this report</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            {reportType === 'Fisherfolk Report' && (
                              <>
                                <th className="px-4 py-3 text-left font-semibold">Registration Number</th>
                                <th className="px-4 py-3 text-left font-semibold">Municipality</th>
                                <th className="px-4 py-3 text-left font-semibold">Barangay</th>
                                <th className="px-4 py-3 text-left font-semibold">Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Main Source of Livelihood</th>
                              </>
                            )}
                            {reportType === 'Boat Registry Report' && (
                              <>
                                <th className="px-4 py-3 text-left font-semibold">MFBR Number</th>
                                <th className="px-4 py-3 text-left font-semibold">Boat Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Owner Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Boat Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Tracker Assignment</th>
                              </>
                            )}
                            {reportType === 'Boundary Violation Report' && (
                              <>
                                <th className="px-4 py-3 text-left font-semibold">MFBR Number</th>
                                <th className="px-4 py-3 text-left font-semibold">Boat Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Owner Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Municipality From</th>
                                <th className="px-4 py-3 text-left font-semibold">Municipality To</th>
                                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {processedData.slice(0,10).map((item,idx)=>(
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              {reportType === 'Fisherfolk Report' && (
                                <>
                                  <td className="px-4 py-2">{item.registration_number || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.address?.municipality || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.address?.barangay || 'N/A'}</td>
                                  <td className="px-4 py-2">{`${item.first_name || ''} ${item.middle_name || ''} ${item.last_name || ''}`}</td>
                                  <td className="px-4 py-2">{item.main_source_livelihood || 'N/A'}</td>
                                </>
                              )}
                              {reportType === 'Boat Registry Report' && (
                                <>
                                  <td className="px-4 py-2">{item.mfbr_number || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.boat_name || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.fisherfolk_registration_number ? `${item.fisherfolk_registration_number.first_name || ''} ${item.fisherfolk_registration_number.middle_name || ''} ${item.fisherfolk_registration_number.last_name || ''}` : 'N/A'}</td>
                                  <td className="px-4 py-2">{item.type_of_boat || 'N/A'}</td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded text-xs ${item.tracker ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                      {item.tracker ? 'Assigned' : 'Unassigned'}
                                    </span>
                                  </td>
                                </>
                              )}
                              {reportType === 'Boundary Violation Report' && (
                                <>
                                  <td className="px-4 py-2">{item.mfbr_number || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.boat_name || 'N/A'}</td>
                                  <td className="px-4 py-2">{typeof item.fisherfolk === 'object' && item.fisherfolk ? `${item.fisherfolk.first_name || ''} ${item.fisherfolk.middle_name || ''} ${item.fisherfolk.last_name || ''}`.trim() : item.fisherfolk || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.from_municipality || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.to_municipality || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.dwell_duration ? `${Math.round(item.dwell_duration / 60)} min` : 'N/A'}</td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${item.report_status === 'Fisherfolk Reported'
                                        ? 'bg-green-100 text-green-800'
                                        : item.report_status === 'Resolved'
                                          ? 'bg-gray-100 text-gray-800'
                                          : 'bg-yellow-100 text-yellow-800'}`}
                                    >
                                      {item.report_status === 'Fisherfolk Reported'
                                        ? 'Fisherfolk Reported'
                                        : item.report_status === 'Resolved'
                                          ? 'Resolved'
                                          : 'Report Pending'}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {processedData.length > 10 && (
                        <p className="text-sm text-gray-500 mt-4 text-center">
                          Showing 10 of {processedData.length} records. Click "Generate Report" to see all records.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-8 text-center text-sm text-gray-500">
                    <p>
                      Date Generated: {new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProvincialReportGeneration;

