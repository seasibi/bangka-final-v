import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUpDownIcon, PlusIcon, MinusIcon, PrinterIcon } from '@heroicons/react/24/solid';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';
import ReportHeader from '../../components/ReportHeader';
import { getFisherfolkReport, getBoatReport, getBoundaryViolationReport } from '../../services/reportService';
import useMunicipalities from '../../hooks/useMunicipalities';
import { getSignatories } from '../../services/signatoriesService';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo.png';

const MunicipalReportGeneration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { municipalities } = useMunicipalities();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('Fisherfolk Report');
  const [groupBy, setGroupBy] = useState(['Municipality']);
  const [sortBy, setSortBy] = useState('Ascending');
  const [filterBy, setFilterBy] = useState('');
  const [reportData, setReportData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [signatories, setSignatories] = useState({ current: null, municipalAgri: null, mayor: null });

  const reportOptions = ['Fisherfolk Report', 'Boat Registry Report', 'Boundary Violation Report'];
  const groupByOptions = ['Municipality', 'Barangay', 'Name', 'Registration Number', 'MFBR Number', 'Boat Name', 'Owner Name', 'Status', 'Reason'];
  const sortByOptions = ['Ascending', 'Descending'];
  const filterByOptions = ['Pending Report', 'Fisherfolk Reported'];

  useEffect(() => {
    fetchReportData();
  }, [reportType]);

  useEffect(() => {
    processData();
  }, [reportData, groupBy, sortBy, filterBy]);

  // Normalize municipality names (case-insensitive + aliases)
  const normalizeMunicipality = (name) => {
    const raw = (name || '').toString().trim();
    const s = raw.toLowerCase();
    if (!s) return raw;
    const map = new Map([
      ['san fernando', 'City Of San Fernando'],
      ['city of san fernando', 'City Of San Fernando'],
      ['sto. tomas', 'Santo Tomas'],
      ['santo tomas', 'Santo Tomas'],
    ]);
    return map.get(s) || raw;
  };

  // Fetch municipal signatories (Municipal Agriculturist and Mayor)
  useEffect(() => {
    const loadSignatories = async () => {
      try {
        if (!user || !municipalities || municipalities.length === 0) return;
        const muni = municipalities.find(m => normalizeMunicipality(m.name) === normalizeMunicipality(user.municipality));
        if (!muni) return;
        const data = await getSignatories({ municipality_id: muni.municipality_id, is_active: true });
        const municipalAgri = (Array.isArray(data) ? data : data?.results || []).find(s => s.position === 'Municipal Agriculturist') || null;
        const mayor = (Array.isArray(data) ? data : data?.results || []).find(s => s.position === 'Mayor') || null;
        const current = { first_name: user?.first_name || '', middle_name: user?.middle_name || '', last_name: user?.last_name || '', position: 'Prepared by' };
        setSignatories({ current, municipalAgri, mayor });
      } catch {
        setSignatories({ current: null, municipalAgri: null, mayor: null });
      }
    };
    loadSignatories();
  }, [user, municipalities]);

  // Helper to format name as FIRST M. LAST (uppercase), middle initial optional
  const formatUpperName = (first = '', middle = '', last = '') => {
    const mi = (middle || '').trim();
    const mid = mi ? `${mi.charAt(0)}.` : '';
    return `${(first || '').trim()} ${mid} ${(last || '').trim()}`.replace(/\s+/g, ' ').trim().toUpperCase();
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let data = [];
      if (reportType === 'Fisherfolk Report') {
        data = await getFisherfolkReport();
      } else if (reportType === 'Boat Registry Report') {
        data = await getBoatReport();
      } else if (reportType === 'Boundary Violation Report') {
        data = await getBoundaryViolationReport();
      }

      // Scope to Municipal Agriculturist's municipality
      if (user?.user_role === 'municipal_agriculturist' && user?.municipality) {
        const muni = user.municipality;
        const sameMuni = (val) => normalizeMunicipality(val) === normalizeMunicipality(muni);
        if (reportType === 'Fisherfolk Report') {
          data = (Array.isArray(data) ? data : []).filter(item => sameMuni(item?.address?.municipality));
        } else if (reportType === 'Boat Registry Report') {
          data = (Array.isArray(data) ? data : []).filter(item => sameMuni(item?.fisherfolk_registration_number?.address?.municipality));
        } else if (reportType === 'Boundary Violation Report') {
          data = (Array.isArray(data) ? data : []).filter(item => sameMuni(item?.from_municipality) || sameMuni(item?.to_municipality));
        }
      }

      setReportData(data);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processData = () => {
    if (!reportData || reportData.length === 0) {
      setProcessedData([]);
      return;
    }

    let filtered = [...reportData];

    if (reportType === 'Boundary Violation Report' && filterBy) {
      const pendingSet = new Set(['Not Reported', 'Under Investigation']);
      if (filterBy === 'Pending Report') {
        filtered = filtered.filter(item => pendingSet.has(String(item.report_status || '')));
      } else if (filterBy === 'Fisherfolk Reported') {
        filtered = filtered.filter(item => String(item.report_status || '') === 'Fisherfolk Reported');
      }
    }

    if (sortBy === 'Ascending') {
      filtered.sort((a, b) => {
        const aVal = getFirstGroupValue(a);
        const bVal = getFirstGroupValue(b);
        if (typeof aVal === 'string') return aVal.localeCompare(bVal);
        return aVal - bVal;
      });
    } else {
      filtered.sort((a, b) => {
        const aVal = getFirstGroupValue(a);
        const bVal = getFirstGroupValue(b);
        if (typeof aVal === 'string') return bVal.localeCompare(aVal);
        return bVal - aVal;
      });
    }

    setProcessedData(filtered);
  };

  const getFirstGroupValue = (item) => {
    const firstGroup = groupBy[0];
    if (!firstGroup) return '';

    if (reportType === 'Fisherfolk Report') {
      if (firstGroup === 'Municipality') return item.address?.municipality || '';
      if (firstGroup === 'Barangay') return item.address?.barangay || '';
      if (firstGroup === 'Name') return `${item.first_name} ${item.last_name}`;
      if (firstGroup === 'Registration Number') return item.registration_number || '';
    } else if (reportType === 'Boat Registry Report') {
      if (firstGroup === 'Municipality') return item.fisherfolk_registration_number?.address?.municipality || '';
      if (firstGroup === 'MFBR Number') return item.mfbr_number || '';
      if (firstGroup === 'Boat Name') return item.boat_name || '';
      if (firstGroup === 'Owner Name') {
        const ff = item.fisherfolk_registration_number;
        return ff ? `${ff.first_name} ${ff.last_name}` : '';
      }
    } else if (reportType === 'Boundary Violation Report') {
      if (firstGroup === 'Municipality') return item.from_municipality || '';
      if (firstGroup === 'MFBR Number') return item.mfbr_number || '';
      if (firstGroup === 'Boat Name') return item.boat_name || '';
      if (firstGroup === 'Owner Name') {
        const ff = item.fisherfolk;
        if (typeof ff === 'object' && ff) {
          return `${ff.first_name || ''} ${ff.last_name || ''}`.trim();
        }
        return ff || '';
      }
      if (firstGroup === 'Status') return item.report_status || '';
      if (firstGroup === 'Reason') return item.reason || '';
    }
    return '';
  };

  const addGroupBy = () => {
    const availableOptions = getAvailableGroupByOptions();
    if (availableOptions.length > 0 && groupBy.length < 3) {
      setGroupBy([...groupBy, availableOptions[0]]);
    }
  };

  const removeGroupBy = (index) => {
    if (groupBy.length > 1) {
      setGroupBy(groupBy.filter((_, i) => i !== index));
    }
  };

  const getAvailableGroupByOptions = () => {
    let options = [];
    if (reportType === 'Fisherfolk Report') {
      options = ['Municipality', 'Barangay', 'Name', 'Registration Number'];
    } else if (reportType === 'Boat Registry Report') {
      options = ['Municipality', 'MFBR Number', 'Boat Name', 'Owner Name'];
    } else if (reportType === 'Boundary Violation Report') {
      options = ['Municipality', 'MFBR Number', 'Boat Name', 'Owner Name', 'Status', 'Reason'];
    }
    return options.filter(opt => !groupBy.includes(opt));
  };

  // Helper function to load map image as data URL
  const loadMapImage = (lat, lng) => {
    return new Promise((resolve) => {
      try {
        const latNum = Number(lat);
        const lngNum = Number(lng);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
          resolve(null);
          return;
        }
        const z = 14;
        const size = '640x400';
        const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${latNum},${lngNum}&zoom=${z}&size=${size}&maptype=mapnik&markers=${latNum},${lngNum},red-pushpin`;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 640, 400);
            resolve(canvas.toDataURL('image/png'));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = mapUrl;
      } catch {
        resolve(null);
      }
    });
  };

  const handleGenerateReport = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const margin = 40;
    const headerHeight = 120;
    const logoWidth = 80;
    const logoHeight = 80;

    const heading = (
      reportType === 'Fisherfolk Report' ? 'Fisherfolk Report' :
      reportType === 'Boat Registry Report' ? 'Boat Registry Report' :
      reportType === 'Boundary Violation Report' ? 'Boundary Violation Report' :
      String(reportType || 'Report')
    );

    const logoImg = new Image();
    logoImg.src = logo;

    const buildColumnsAndRows = () => {
      if (reportType === 'Fisherfolk Report') {
        const columns = [
          { header: 'Registration #', dataKey: 'reg' },
          { header: 'Municipality', dataKey: 'municipality' },
          { header: 'Barangay', dataKey: 'barangay' },
          { header: 'Name', dataKey: 'name' },
          { header: 'Main Livelihood', dataKey: 'livelihood' },
        ];
        const rows = processedData.map(item => ({
          reg: item.registration_number || 'N/A',
          municipality: item.address?.municipality || 'N/A',
          barangay: item.address?.barangay || 'N/A',
          name: `${item.first_name} ${item.middle_name || ''} ${item.last_name}`.replace(/\s+/g,' ').trim(),
          livelihood: item.main_source_livelihood || 'N/A',
        }));
        return { columns, rows };
      }
      if (reportType === 'Boat Registry Report') {
        const columns = [
          { header: 'MFBR #', dataKey: 'mfbr' },
          { header: 'Boat Name', dataKey: 'boat' },
          { header: 'Owner Name', dataKey: 'owner' },
          { header: 'Boat Type', dataKey: 'type' },
          { header: 'Tracker', dataKey: 'tracker' },
        ];
        const rows = processedData.map(item => {
          const ff = item.fisherfolk_registration_number;
          const owner = ff ? `${ff.first_name} ${ff.middle_name || ''} ${ff.last_name}`.replace(/\s+/g,' ').trim() : 'N/A';
          return {
            mfbr: item.mfbr_number || 'N/A',
            boat: item.boat_name || 'N/A',
            owner,
            type: item.type_of_boat || 'N/A',
            tracker: item.tracker ? 'Assigned' : 'Unassigned',
          };
        });
        return { columns, rows };
      }
      // Boundary Violation
      const columns = [
        { header: 'MFBR #', dataKey: 'mfbr' },
        { header: 'Boat Name', dataKey: 'boat' },
        { header: 'Owner Name', dataKey: 'owner' },
        { header: 'From', dataKey: 'from' },
        { header: 'To', dataKey: 'to' },
        { header: 'Reason/Duration', dataKey: 'reason' },
        { header: 'Status', dataKey: 'status' },
      ];
      const rows = processedData.map(item => {
        const fishermanName = typeof item.fisherfolk === 'object' && item.fisherfolk
          ? `${item.fisherfolk.first_name || ''} ${item.fisherfolk.middle_name || ''} ${item.fisherfolk.last_name || ''}`.replace(/\s+/g,' ').trim()
          : (item.fisherfolk || 'N/A');
        return {
          mfbr: item.mfbr_number || 'N/A',
          boat: item.boat_name || 'N/A',
          owner: fishermanName,
          from: item.from_municipality || 'N/A',
          to: item.to_municipality || 'N/A',
          reason: item.dwell_duration ? `${Math.round(item.dwell_duration / 60)} min` : (item.reason || 'N/A'),
          status: item.report_status === 'Fisherfolk Reported' ? 'Fisherfolk Reported' : item.report_status === 'Resolved' ? 'Resolved' : 'Report Pending',
        };
      });
      return { columns, rows };
    };

    const { columns, rows } = buildColumnsAndRows();

    const titleY = headerHeight + 30;
    const dateY = titleY + 24 + 6;
    const tableStartY = dateY + 20;

    autoTable(doc, {
      startY: tableStartY,
      head: [columns.map(c => c.header)],
      body: rows.map(r => columns.map(c => r[c.dataKey])),
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: margin, right: margin },
      theme: 'striped',
      didDrawPage: (data) => {
        // Header (first page only)
        const pageNumber = doc.internal.getCurrentPageInfo ? doc.internal.getCurrentPageInfo().pageNumber : doc.internal.getNumberOfPages();
        if (pageNumber === 1) {
          try { doc.addImage(logoImg, 'PNG', margin, 20, logoWidth, logoHeight); } catch (e) {}
          doc.setFontSize(16); doc.setFont('helvetica','bold');
          doc.text('Office of the Provincial Agriculturist - Fisheries Section', margin + logoWidth + 20, 40);
          doc.setFontSize(10); doc.setFont('helvetica','normal');
          doc.text('Provincial Agriculturist Office, Aguila Road, Brgy. II', margin + logoWidth + 20, 60);
          doc.text('City of San Fernando, La Union 2500', margin + logoWidth + 20, 74);
          doc.text('Phone: (072) 888-3184 / 607-4492 / 607-4488', margin + logoWidth + 20, 88);
          doc.text('Email: opaglaunion@yahoo.com', margin + logoWidth + 20, 102);
          doc.setLineWidth(1); doc.line(margin, headerHeight, doc.internal.pageSize.getWidth() - margin, headerHeight);
          // Title
          const pw = doc.internal.pageSize.getWidth();
          doc.setFontSize(24); doc.setFont('helvetica','bold');
          doc.text(heading, pw/2, titleY, { align: 'center' });
        }
        // Footer (copyright left, date right)
        doc.setFontSize(10);
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const leftX = data.settings.margin.left;
        const rightX = pageW - data.settings.margin.left;
        const footY = pageH - 20;
        doc.text(`  ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`, leftX, footY);
        doc.text(`Date generated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`, rightX, footY, { align: 'right' });
      },
    });

    // Add map screenshots for boundary violation reports
    if (reportType === 'Boundary Violation Report' && processedData.length > 0) {
      for (const item of processedData) {
        if (item.current_lat && item.current_lng) {
          doc.addPage();
          let y = margin;
          
          // Add header on new page
          try { doc.addImage(logoImg, 'PNG', margin, y, logoWidth, logoHeight); } catch (e) {}
          doc.setFontSize(14); doc.setFont('helvetica','bold');
          doc.text('Violation Location Map', margin + logoWidth + 20, y + 30);
          y += logoHeight + 20;
          
          // Violation details
          doc.setFont('helvetica','normal'); doc.setFontSize(10);
          doc.text(`MFBR: ${item.mfbr_number || 'N/A'}`, margin, y);
          y += 15;
          doc.text(`Boat: ${item.boat_name || 'N/A'}`, margin, y);
          y += 15;
          doc.text(`Location: ${item.to_municipality || 'N/A'}`, margin, y);
          y += 15;
          doc.text(`Coordinates: ${Number(item.current_lat).toFixed(6)}, ${Number(item.current_lng).toFixed(6)}`, margin, y);
          y += 25;
          
          // Load and add map image
          const mapDataUrl = await loadMapImage(item.current_lat, item.current_lng);
          const mapWidth = pw - margin * 2;
          const mapHeight = 300;
          
          if (mapDataUrl) {
            try {
              doc.addImage(mapDataUrl, 'PNG', margin, y, mapWidth, mapHeight);
            } catch {
              doc.setDrawColor(209,213,219); 
              doc.setLineWidth(1); 
              doc.rect(margin, y, mapWidth, mapHeight);
              doc.setFontSize(11); 
              doc.setTextColor(107,114,128); 
              doc.text('Map image unavailable', pw/2, y + mapHeight/2, { align:'center' }); 
              doc.setTextColor(17,24,39);
            }
          } else {
            doc.setDrawColor(209,213,219); 
            doc.setLineWidth(1); 
            doc.rect(margin, y, mapWidth, mapHeight);
            doc.setFontSize(11); 
            doc.setTextColor(107,114,128); 
            doc.text('Map image unavailable', pw/2, y + mapHeight/2, { align:'center' }); 
            doc.setTextColor(17,24,39);
          }
        }
      }
    }

    // Signatories block on last page
    const lastPage = doc.internal.getNumberOfPages();
    doc.setPage(lastPage);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const blockTop = ph - 120; // above footer
    const colW = (pw - margin*2) / 3;
    const x0 = margin;
    const x1 = margin + colW;
    const x2 = margin + colW*2;
    const roleLabel = 'Municipal Agriculturist';

    const preparedName = user ? `${user.first_name || ''} ${user.middle_name ? user.middle_name.charAt(0)+'. ' : ''}${user.last_name || ''}`.replace(/\s+/g,' ').trim().toUpperCase() : '';
    const userRegisteredPosition = user?.municipal_agriculturist?.position || user?.position || '';
    const preparedTitle = user?.user_role === 'municipal_agriculturist'
      ? `Municipal Agriculturist${userRegisteredPosition ? ` - ${userRegisteredPosition}` : ''}`
      : 'Prepared by';

    const maName = signatories.municipalAgri ? `${signatories.municipalAgri.first_name || ''} ${signatories.municipalAgri.middle_name ? signatories.municipalAgri.middle_name.charAt(0)+'. ' : ''}${signatories.municipalAgri.last_name || ''}`.replace(/\s+/g,' ').trim().toUpperCase() : '';
    const mayorName = signatories.mayor ? `${signatories.mayor.first_name || ''} ${signatories.mayor.middle_name ? signatories.mayor.middle_name.charAt(0)+'. ' : ''}${signatories.mayor.last_name || ''}`.replace(/\s+/g,' ').trim().toUpperCase() : '';

    const drawSig = (x, title, name) => {
      doc.setLineWidth(1); doc.line(x, blockTop+40, x+colW-20, blockTop+40);
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(name || ' ', x + (colW-20)/2, blockTop+54, { align: 'center' });
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(title, x + (colW-20)/2, blockTop+70, { align: 'center' });
    };
    drawSig(x0, preparedTitle, preparedName);
    drawSig(x1, 'Municipal Agriculturist', maName);
    drawSig(x2, 'Municipal Mayor', mayorName);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => {
        try { w.focus(); w.print(); } catch (e) {}
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="px-6 py-6">
         <div className="flex justify-between items-center ">
          <div className="grid grid-cols-1 grid-rows-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              REPORT GENERATION
            </h1>
            <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Generate reports, start with selecting report type
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-100 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Sorting Pane</h3>
              <p className="text-sm text-gray-600 mb-6">Sort the data you need</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Report</label>
                <select
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value);
                    setGroupBy(['Municipality']);
                    setFilterBy('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {reportOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Group by:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={addGroupBy}
                      disabled={groupBy.length >= 3}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Add grouping"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => removeGroupBy(groupBy.length - 1)}
                      disabled={groupBy.length <= 1}
                      className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove grouping"
                    >
                      <MinusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {groupBy.map((group, index) => (
                    <select
                      key={index}
                      value={group}
                      onChange={(e) => {
                        const newGroupBy = [...groupBy];
                        newGroupBy[index] = e.target.value;
                        setGroupBy(newGroupBy);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {groupByOptions.concat(group).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {sortByOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {reportType === 'Boundary Violation Report' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by:</label>
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {filterByOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleGenerateReport}
                disabled={loading || processedData.length === 0}
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
                <div className="flex justify-center items-center py-20">
                  <Loader />
                </div>
              ) : (
                <>
                  <ReportHeader />
                  <h2 className="text-2xl font-bold text-center my-6">{reportType}</h2>
                  {processedData.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                          {processedData.slice(0, 10).map((item, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              {reportType === 'Fisherfolk Report' && (
                                <>
                                  <td className="px-4 py-2">{item.registration_number || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.address?.municipality || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.address?.barangay || 'N/A'}</td>
                                  <td className="px-4 py-2">{`${item.first_name} ${item.middle_name || ''} ${item.last_name}`}</td>
                                  <td className="px-4 py-2">{item.main_source_livelihood || 'N/A'}</td>
                                </>
                              )}
                              {reportType === 'Boat Registry Report' && (
                                <>
                                  <td className="px-4 py-2">{item.mfbr_number || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.boat_name || 'N/A'}</td>
                                  <td className="px-4 py-2">
                                    {item.fisherfolk_registration_number
                                      ? `${item.fisherfolk_registration_number.first_name} ${item.fisherfolk_registration_number.middle_name || ''} ${item.fisherfolk_registration_number.last_name}`
                                      : 'N/A'}
                                  </td>
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
                                  <td className="px-4 py-2">
                                    {typeof item.fisherfolk === 'object' && item.fisherfolk
                                      ? `${item.fisherfolk.first_name || ''} ${item.fisherfolk.middle_name || ''} ${item.fisherfolk.last_name || ''}`.trim()
                                      : item.fisherfolk || 'N/A'}
                                  </td>
                                  <td className="px-4 py-2">{item.from_municipality || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.to_municipality || 'N/A'}</td>
                                  <td className="px-4 py-2">{item.dwell_duration ? `${Math.round(item.dwell_duration / 60)} min` : 'N/A'}</td>
                                  <td className="px-4 py-2">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      item.report_status === 'Fisherfolk Reported' ? 'bg-green-100 text-green-800' :
                                      item.report_status === 'Resolved' ? 'bg-gray-100 text-gray-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {item.report_status === 'Fisherfolk Reported' ? 'Fisherfolk Reported' : item.report_status === 'Resolved' ? 'Resolved' : 'Report Pending'}
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
                    <p>Date Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
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

export default MunicipalReportGeneration;