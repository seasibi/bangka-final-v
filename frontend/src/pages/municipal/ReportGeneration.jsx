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

  const handleGenerateReport = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintContent();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
  };

  const generatePrintContent = () => {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let tableHeaders = '';
    let tableRows = '';
    const heading = (
      reportType === 'Fisherfolk Report' ? 'Fisherfolk Report' :
      reportType === 'Boat Registry Report' ? 'Boat Registry Report' :
      reportType === 'Boundary Violation Report' ? 'Boundary Violation Report' :
      String(reportType || 'Report')
    );

    if (reportType === 'Fisherfolk Report') {
      tableHeaders = `
        <th class="px-4 py-3 text-left">Registration Number</th>
        <th class="px-4 py-3 text-left">Municipality</th>
        <th class="px-4 py-3 text-left">Barangay</th>
        <th class="px-4 py-3 text-left">Name</th>
        <th class="px-4 py-3 text-left">Main Source of Livelihood</th>
      `;
      tableRows = processedData.map(item => `
        <tr class="border-b">
          <td class="px-4 py-2">${item.registration_number || 'N/A'}</td>
          <td class="px-4 py-2">${item.address?.municipality || 'N/A'}</td>
          <td class="px-4 py-2">${item.address?.barangay || 'N/A'}</td>
          <td class="px-4 py-2">${item.first_name} ${item.middle_name || ''} ${item.last_name}</td>
          <td class="px-4 py-2">${item.main_source_livelihood || 'N/A'}</td>
        </tr>
      `).join('');
    } else if (reportType === 'Boat Registry Report') {
      tableHeaders = `
        <th class="px-4 py-3 text-left">MFBR Number</th>
        <th class="px-4 py-3 text-left">Boat Name</th>
        <th class="px-4 py-3 text-left">Owner Name</th>
        <th class="px-4 py-3 text-left">Boat Type</th>
        <th class="px-4 py-3 text-left">Tracker Assignment</th>
      `;
      tableRows = processedData.map(item => {
        const owner = item.fisherfolk_registration_number;
        return `
          <tr class="border-b">
            <td class="px-4 py-2">${item.mfbr_number || 'N/A'}</td>
            <td class="px-4 py-2">${item.boat_name || 'N/A'}</td>
            <td class="px-4 py-2">${owner ? `${owner.first_name} ${owner.middle_name || ''} ${owner.last_name}` : 'N/A'}</td>
            <td class="px-4 py-2">${item.type_of_boat || 'N/A'}</td>
            <td class="px-4 py-2">${item.tracker ? 'Assigned' : 'Unassigned'}</td>
          </tr>
        `;
      }).join('');
    } else if (reportType === 'Boundary Violation Report') {
      tableHeaders = `
        <th class="px-4 py-3 text-left">MFBR Number</th>
        <th class="px-4 py-3 text-left">Boat Name</th>
        <th class="px-4 py-3 text-left">Owner Name</th>
        <th class="px-4 py-3 text-left">Municipality From</th>
        <th class="px-4 py-3 text-left">Municipality To</th>
        <th class="px-4 py-3 text-left">Reason</th>
        <th class="px-4 py-3 text-left">Status</th>
      `;
      tableRows = processedData.map(item => {
        const fishermanName = typeof item.fisherfolk === 'object' && item.fisherfolk
          ? `${item.fisherfolk.first_name || ''} ${item.fisherfolk.middle_name || ''} ${item.fisherfolk.last_name || ''}`.trim()
          : item.fisherfolk || 'N/A';
        return `
        <tr class="border-b">
          <td class="px-4 py-2">${item.mfbr_number || 'N/A'}</td>
          <td class="px-4 py-2">${item.boat_name || 'N/A'}</td>
          <td class="px-4 py-2">${fishermanName}</td>
          <td class="px-4 py-2">${item.from_municipality || 'N/A'}</td>
          <td class="px-4 py-2">${item.to_municipality || 'N/A'}</td>
          <td class="px-4 py-2">${item.dwell_duration ? `${Math.round(item.dwell_duration / 60)} minutes` : 'N/A'}</td>
          <td class="px-4 py-2">
            ${(() => {
              const rs = String(item.report_status || '');
              const label = rs === 'Fisherfolk Reported' ? 'Fisherfolk Reported' : rs === 'Resolved' ? 'Resolved' : 'Report Pending';
              const cls = rs === 'Fisherfolk Reported' ? 'text-green-600' : rs === 'Resolved' ? 'text-gray-600' : 'text-yellow-600';
              return `<span class=\"${cls}\">${label}</span>`;
            })()}
          </td>
        </tr>
      `}).join('');
    }

    const sigCurrent = signatories.current ? formatUpperName(signatories.current.first_name, signatories.current.middle_name, signatories.current.last_name) : '';
    const sigMA = signatories.municipalAgri ? `${signatories.municipalAgri.first_name || ''} ${signatories.municipalAgri.middle_name || ''} ${signatories.municipalAgri.last_name || ''}`.trim().toUpperCase() : '';
    const sigMayor = signatories.mayor ? `${signatories.mayor.first_name || ''} ${signatories.mayor.middle_name || ''} ${signatories.mayor.last_name || ''}`.trim().toUpperCase() : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title></title>
        <style>
          :root {
            --primary: #2563EB;
            --footer-offset: 110px;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; }
          body { font-family: 'Arial', sans-serif; background: white; }
          .page { min-height: 100vh; display: flex; flex-direction: column; padding: 40px; }
          .header { display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { width: 80px; height: 80px; margin-right: 20px; }
          .header-text h1 { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
          .header-text p { font-size: 12px; line-height: 1.5; }
          .report-title { text-align: center; font-size: 22px; font-weight: 700; margin: 26px 0 16px; color: #111827; position: relative; z-index: 1; }
          .content { flex: 1 0 auto; display: block; }
          .section-title { background: #DBEAFE; color: #1D4ED8; font-weight: 600; padding: 6px 8px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; }
          .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead tr { background-color: var(--primary); color: #fff; }
          th { padding: 12px; text-align: left; font-weight: 600; font-size: 12px; }
          td { padding: 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
          tr:nth-child(even) { background-color: #F9FAFB; }
          .footer { margin-top: 24px; padding-top: 8px; text-align: center; font-size: 12px; color: #666; background: #fff; }
          .signatories { margin-top: 28px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
          .sig-block { text-align: center; }
          .sig-line { margin-top: 48px; border-top: 1px solid #111; padding-top: 6px; font-weight: 600; }
          .sig-title { font-size: 12px; color: #444; }
          @media print {
            @page { size: A4; margin: 1cm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 0 1cm; min-height: 100vh; display: flex; flex-direction: column; }
            .header { position: static; background: white; z-index: 1; }
            .report-title { margin-top: 12px; }
            .content { margin-top: 8px; margin-bottom: var(--footer-offset); flex: 1 1 auto; }
            .footer { position: fixed; bottom: 1cm; left: 1cm; right: 1cm; margin-top: 0; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <img src="/src/assets/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'">
            <div class="header-text">
              <h1>Office of the Provincial Agriculturist - Fisheries Section</h1>
              <p>
                Provincial Agriculturist Office, Aguila Road, Brgy. II<br>
                City of San Fernando, La Union 2500<br>
                Phone: (072) 888-3184 / 607-4492 / 607-4488<br>
                Email: opaglaunion@yahoo.com
              </p>
            </div>
          </div>

          <div class="report-title">${heading}</div>

          <div class="content">
            <div class="card">
              <table>
              <thead>
                <tr>${tableHeaders}</tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
              <tfoot>
                <tr><td colspan="999" style="height: var(--footer-offset);"></td></tr>
              </tfoot>
              </table>
            </div>
            <div class="signatories">
              <div class="sig-block">
                <div class="sig-line">${sigCurrent || '&nbsp;'}</div>
                <div class="sig-title">Municipal Agriculturist</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">${sigMA || '&nbsp;'}</div>
                <div class="sig-title">Municipal Agriculturist</div>
              </div>
              <div class="sig-block">
                <div class="sig-line">${sigMayor || '&nbsp;'}</div>
                <div class="sig-title">Municipal Mayor</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Date Generated: ${currentDate}</p>
            <p>&copy; ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section</p>
          </div>
        </div>
      </body>
      <script>
        window.addEventListener('load', function () {
          setTimeout(function(){ window.print(); }, 50);
        });
      </script>
      </html>
    `;
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <PageTitle value="REPORT GENERATION" />
            <p className="text-sm text-gray-600">Generate reports according to your needs. Start by choosing a report.</p>
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

                  {/* Signatories */}
                  <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                        {(signatories.current && formatUpperName(signatories.current.first_name, signatories.current.middle_name, signatories.current.last_name)) || '\u00A0'}
                      </div>
                      <div className="text-xs text-gray-600">Municipal Agriculturist</div>
                    </div>
                    <div className="text-center">
                      <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                        {(signatories.municipalAgri && `${signatories.municipalAgri.first_name || ''} ${signatories.municipalAgri.middle_name || ''} ${signatories.municipalAgri.last_name || ''}`.trim().toUpperCase()) || '\u00A0'}
                      </div>
                      <div className="text-xs text-gray-600">Municipal Agriculturist</div>
                    </div>
                    <div className="text-center">
                      <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                        {(signatories.mayor && `${signatories.mayor.first_name || ''} ${signatories.mayor.middle_name || ''} ${signatories.mayor.last_name || ''}`.trim().toUpperCase()) || '\u00A0'}
                      </div>
                      <div className="text-xs text-gray-600">Municipal Mayor</div>
                    </div>
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