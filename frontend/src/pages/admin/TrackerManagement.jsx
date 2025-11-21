import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Button from "../../components/Button";
import Modal from '../../components/Modal';
import Loader from "../../components/Loader";
import { getTrackers, apiUpdateTrackerStatus } from "../../services/trackerService";
import { getDeviceTokenByName } from "../../services/deviceTokenService";
import AddTrackerModal from "../../components/Tracker/AddTrackerModal";

const TrackerManagement = () => {
  // Simple pagination controls component (copied/adapted from FisherfolkManagement)
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

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];

  // reset page when pageSize or trackers length changes
  const [trackers, setTrackers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState(null);
  const [tokensByName, setTokensByName] = useState({});
  const [query, setQuery] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all"); // all, assigned, unassigned
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrackers();
  }, []);

  const fetchTrackers = async () => {
    try {
      setLoading(true);
      setError(null);

      const trackers = await getTrackers();

      // fetch token info for each tracker by name
      const tokenPairs = await Promise.all(
        trackers.map(async (t) => {
          try {
            const tok = await getDeviceTokenByName(t.BirukBilugID);
            return [t.BirukBilugID, tok];
          } catch (e) {
            return [t.BirukBilugID, null];
          }
        })
      );
      const map = Object.fromEntries(tokenPairs);

      setTrackers(trackers);
      setTokensByName(map);
      setError(null);
    } catch (err) {
      setError('Failed to fetch trackers');
    } finally {
      setLoading(false);
    }
  };

  // reset page when pageSize or trackers length changes
  useEffect(() => {
    setPage(1);
  }, [pageSize, trackers?.length]);


  const handleUpdateStatusClick = (tracker) => {
    setSelectedTracker(tracker);
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTracker) return;
    try {
      setError(null);
      // Toggle status using the service (keeps baseURL/env/cookies consistent)
      const nextStatus = selectedTracker.status === "available" ? "assigned" : "available";
      await apiUpdateTrackerStatus(selectedTracker.BirukBilugID, nextStatus);
      setIsStatusModalOpen(false);
      fetchTrackers();
    } catch (error) {
      setError("Failed to update status. Please try again.");
    }
  };

  // derive filtered/sorted/paginated rows for rendering (avoid IIFE in JSX)
  const computeStatus = (t) => {
    const tok = tokensByName[t.BirukBilugID];
    if (!tok) return 'no-token';
    if (!tok.last_seen_at) return 'never';
    try {
      const age = (Date.now() - new Date(tok.last_seen_at).getTime()) / 1000;
      return age <= 180 ? 'online' : 'offline';
    } catch (e) {
      return 'offline';
    }
  };

  const formatLastSeen = (tok) => {
    if (!tok?.last_seen_at) return '—';
    try {
      return new Date(tok.last_seen_at).toLocaleString();
    } catch (e) {
      return tok.last_seen_at;
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = [...trackers].filter(t => {
    // Filter by search query
    const matchesQuery = !q || t.BirukBilugID.toLowerCase().includes(q) || (t.municipality || '').toLowerCase().includes(q);

    // Filter by assignment status
    let matchesAssignment = true;
    if (assignmentFilter === "assigned") {
      matchesAssignment = t.status === "assigned";
    } else if (assignmentFilter === "unassigned") {
      matchesAssignment = t.status === "available";
    }

    return matchesQuery && matchesAssignment;
  });
  const sorted = filtered.sort((a, b) => {
    // First, sort by assignment status (assigned first)
    const aIsAssigned = a.status === "assigned" ? 1 : 0;
    const bIsAssigned = b.status === "assigned" ? 1 : 0;
    if (aIsAssigned !== bIsAssigned) {
      return bIsAssigned - aIsAssigned; // assigned (1) comes before unassigned (0)
    }

    // Then sort by date_added (newest first) within each group
    if (a.date_added && b.date_added) {
      return new Date(b.date_added) - new Date(a.date_added);
    }
    return 0;
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginatedRows = sorted.slice(start, start + pageSize);

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex justify-between items-center ml-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/birukbilugTracking')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div className="grid grid-cols-1 grid-rows-2">
              <h1 className="text-3xl font-bold text-gray-900 mt-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                TRACKER MANAGEMENT
              </h1>
              <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                List of registered trackers in La Union
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID or municipality..."
              className="pl-3 pr-3 py-2 w-64 bg-white border border-gray-300 rounded-lg text-sm"
            />
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded">Add Tracker</Button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 text-red-700 bg-red-100 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow w-full font-montserrat p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Rows per page:</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
                {pageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div className="text-sm text-gray-600">Total: {trackers.length}</div>
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">All Trackers</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            <PaginationControls page={page} setPage={setPage} pageSize={pageSize} total={trackers.length} />
          </div>

          <div className="overflow-y-auto max-h-[60vh] rounded-b">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Municipality</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Assignment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Seen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date Added</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No trackers found</td></tr>
                ) : (
                  paginatedRows.map((tracker, idx) => {
                    const rowIndex = start + idx;
                    const tok = tokensByName[tracker.BirukBilugID];
                    // simple status computation
                    let statusLabel = 'No token';
                    if (tok) {
                      if (tok.is_active === false) statusLabel = 'Lost';
                      else if (!tok.last_seen_at) statusLabel = 'Never seen';
                      else {
                        const age = (Date.now() - new Date(tok.last_seen_at).getTime()) / 1000;
                        statusLabel = age <= 180 ? 'Online' : 'Offline';
                      }
                    }

                    const assignmentStatus = tracker.status === "assigned" ? "Assigned" : "Unassigned";
                    const assignmentColor = tracker.status === "assigned" ? "text-green-600" : "text-gray-600";

                    return (
                      <tr key={tracker.BirukBilugID} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{tracker.BirukBilugID}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{tracker.municipality}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${assignmentColor}`}>{assignmentStatus}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{statusLabel}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatLastSeen(tokensByName[tracker.BirukBilugID])}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tracker.date_added ? new Date(tracker.date_added).toLocaleString() : '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => navigate(`/admin/TrackerManagement/view/${encodeURIComponent(tracker.BirukBilugID)}`)}>View Tracker</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} onConfirm={handleUpdateStatus} title={selectedTracker?.status === 'available' ? 'Assign' : 'Make Available'} message={`Are you sure you want to mark this tracker as ${selectedTracker?.status === 'available' ? 'assigned' : 'available'}?`} confirmText={selectedTracker?.status === 'available' ? 'Assign' : 'Available'} />

        <AddTrackerModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onCreated={fetchTrackers} />
      </div>
    </div>
  );
};

export default TrackerManagement;
