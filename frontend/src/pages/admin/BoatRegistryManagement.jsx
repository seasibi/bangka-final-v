import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import BoatList from '../../components/BoatRegistry/BoatList';
import { getBoats, archiveFisherfolkBoat } from '../../services/boatService';
import { getFisherfolk } from '../../services/fisherfolkService';
import { getTrackers, assignTrackerToBoat } from '../../services/trackerService';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Loader from '../../components/Loader';

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
const muniEq = (a, b) => normalizeMunicipality(a) === normalizeMunicipality(b);

// Pagination controls (copied pattern from FisherfolkManagement)
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

const AdminBoatRegistryManagement = () => {
  const [boats, setBoats] = useState([]);
  const [fisherfolk, setFisherfolk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTrackers, setAssignTrackers] = useState([]);
  const [selectedAssignBoat, setSelectedAssignBoat] = useState(null);
  const [selectedTrackerId, setSelectedTrackerId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];
  const [statusFilter, setStatusFilter] = useState('all');
  const [trackerFilter, setTrackerFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBoats();
  }, []);

  const fetchBoats = async () => {
    try {
      setLoading(true);
      // Fetch all boats
      const boatsData = await getBoats();
      // Fetch all fisherfolk
      const fisherfolkData = await getFisherfolk();
      console.log("Fetched boats:", boatsData);
      console.log("Fetched fisherfolk:", fisherfolkData);

      // Optionally, you can join boats with their fisherfolk if needed
      // For now, just set boats as is
      setBoats(boatsData);
      setFisherfolk(fisherfolkData);
      setError(null);
    } catch {
      setError('Failed to fetch boats');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBoat = () => {
    navigate('/admin/boat-registry/add');
  };

  const handleEditBoat = (boatId) => {
    navigate(`/admin/boat-registry/edit/${boatId}`);
  };

  const handleArchiveClick = (boatregId) => {
    const boat = boats.find(b => b.boat_registry_no === boatregId);
    console.log('Selected boat for archiving:', boat);
    if (boat) {
      setSelectedBoat(boat);
      setIsArchiveModalOpen(true);
    }
  };

  const handleAssignClick = async (mfbrNumber) => {
  const boat = boats.find(b => b.mfbr_number === mfbrNumber);
  if (boat) {
    setSelectedAssignBoat(boat);
    try {
      const allTrackers = await getTrackers();
      const mun = boat?.fisherfolk?.address?.municipality || boat?.fisherfolk?.municipality || '';
      const available = (Array.isArray(allTrackers) ? allTrackers : allTrackers?.results || [])
        .filter(t => t.status === 'available' && (!mun || muniEq(t.municipality, mun)));
      setAssignTrackers(available);
      setIsAssignModalOpen(true);
    } catch {
      setError('Failed to fetch trackers');
    }
  }
};

  const handleArchiveConfirm = async () => {
    if (!selectedBoat) return;

    try {
      await archiveFisherfolkBoat(selectedBoat.boat_registry_no);
      setSuccess(`Boat "${selectedBoat.boat_registry_no.boat_name}" has been archived`);
      await fetchBoats();
      setIsArchiveModalOpen(false);
      fetchBoats();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to archive boat');
    }
  };

  // reset page when boats or pageSize change
  useEffect(() => {
    setPage(1);
  }, [pageSize, boats.length]);

  if (loading) {
    return (
     <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <Loader/>
        </div>
      </div>
    );
  }

  // Derived filtering + pagination
  const filteredBoats = boats
    .filter(b => statusFilter === 'all' ? true : statusFilter === 'active' ? b.is_active === true : b.is_active === false)
    .filter(b => {
      if (trackerFilter === 'all') return true;
      const hasTracker = !!b.tracker;
      return trackerFilter === 'with' ? hasTracker : !hasTracker;
    });
  const sortedBoats = [...filteredBoats].sort((a, b) => {
    // Active boats first (by their own status)
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    // Within inactive, sort by last fisherfolk deactivation time (most recent first)
    if (!a.is_active && !b.is_active) {
      try {
        const map = JSON.parse(localStorage.getItem('ff_last_deactivated') || '{}');
        const ka = a.fisherfolk?.registration_number || a.fisherfolk?.id;
        const kb = b.fisherfolk?.registration_number || b.fisherfolk?.id;
        const ta = typeof map[ka] === 'number' ? map[ka] : Number(map[ka]) || 0;
        const tb = typeof map[kb] === 'number' ? map[kb] : Number(map[kb]) || 0;
        if (ta !== tb) return tb - ta;
      } catch {}
    }
    if (a.date_added && b.date_added) return new Date(b.date_added) - new Date(a.date_added);
    return (b.id || 0) - (a.id || 0);
  });
  const totalFiltered = sortedBoats.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const paginatedRows = sortedBoats.slice(start, end);

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex justify-between items-center mb-6">
          <PageTitle value="Boat Registry Management" />
          <Button onClick={handleAddBoat}
          style={{ backgroundColor: '#3863CF', fontFamily: 'Montserrat, sans-serif' }}>Add New Boat</Button>
        </div>

        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 text-green-700 bg-green-100 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow w-full font-montserrat p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
              >
                {pageOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="text-sm text-gray-600">Total: {filteredBoats.length}</div>
              <label className="ml-4 text-sm text-gray-700">Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <label className="ml-4 text-sm text-gray-700">Tracker:</label>
              <select value={trackerFilter} onChange={(e) => setTrackerFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="all">All</option>
                <option value="with">With tracker</option>
                <option value="without">Without tracker</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <PaginationControls
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                total={filteredBoats.length}
              />
            </div>
          </div>

          <table className="w-full divide-y divide-gray-200">
            <thead className="sticky top-0 w-full">
              <tr style={{ backgroundColor: '#3863CF', fontFamily: 'Montserrat, sans-serif' }}>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Boat Registry Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Boat Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Tracker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Fisherfolk Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No boats found</td>
              </tr>
            ) : (
              paginatedRows.map((boat, index) => {
                const rowIndex = start + index;
                const fisherfolkActive = boat.fisherfolk?.is_active ?? true;
                return (
                  <tr key={boat.mfbr_number || rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{boat.mfbr_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${boat.boat_type === 'Motorized' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{boat.boat_type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{boat.tracker ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">Tracker {boat.tracker.BirukBilugID}</span> : <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs">No tracker assigned</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{boat.fisherfolk ? `${boat.fisherfolk.first_name || ''} ${boat.fisherfolk.last_name || ''}` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${boat.is_active === true ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{boat.is_active === true ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                      {fisherfolkActive ? (
                        <button onClick={() => navigate(`/admin/boat-registry/profile/${boat.mfbr_number}`)} className="text-white bg-blue-700 py-1 px-3 hover:bg-blue-500 rounded-md">View Boat Profile</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>

        <Modal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          onConfirm={handleArchiveConfirm}
          title="Archive Boat"
          message={`Are you sure you want to archive the boat "${selectedBoat?.boat.boat_name}"?`}
          confirmText="Archive"
          cancelText="Cancel"
        />

        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          onConfirm={async () => {
            await assignTrackerToBoat(selectedAssignBoat.mfbr_number, selectedTrackerId);
            // Then refresh boats and close modal
            setIsAssignModalOpen(false);
            setSelectedTrackerId('');
            setSelectedAssignBoat(null);
            await fetchBoats();
          }}
          title="Assign Tracker"
          message={
            assignTrackers.length === 0
              ? "No available trackers for this municipality."
              : (
                <div>
                  <div>Select a tracker to assign:</div>
                  <select
                    value={selectedTrackerId}
                    onChange={e => setSelectedTrackerId(e.target.value)}
                    className="w-full mt-2 border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">-- Select Tracker --</option>
                    {assignTrackers.map(tracker => (
                      <option key={tracker.BirukBilugID} value={tracker.BirukBilugID}>
                        {tracker.municipality} - {tracker.status} (ID: {tracker.BirukBilugID})
                      </option>
                    ))}
                  </select>
                </div>
              )
          }
          confirmText={assignTrackers.length === 0 ? "" : "Assign"}
  cancelText="Cancel"
        />

      </div>
    </div>
  );
};

export default AdminBoatRegistryManagement;