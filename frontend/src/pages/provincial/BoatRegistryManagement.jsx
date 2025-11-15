import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import BoatList from '../../components/BoatRegistry/BoatList';
import { getBoats, archiveFisherfolkBoat } from '../../services/boatService';
import { getFisherfolk } from '../../services/fisherfolkService';
import { getTrackers, assignTrackerToBoat } from '../../services/trackerService';
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

const PABoatRegistryManagement = () => {
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
  // Filters and pagination
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];
  const navigate = useNavigate();

  useEffect(() => {
    fetchBoats();
  }, []);

  // reset to first page when filter, page size, or data changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize, boats.length]);

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

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <Loader />
        </div>
      </div>
    );
  }

  // filtering + pagination
  const filteredBoats = boats.filter(b =>
    statusFilter === 'all' ? true : statusFilter === 'active' ? b.is_active : !b.is_active
  );
  const totalPages = Math.max(1, Math.ceil(filteredBoats.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = filteredBoats.slice(start, start + pageSize);

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex justify-between items-center">
          <div className="grid grid-cols-1 grid-rows-2 ml-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              BOAT REGISTRY MANAGEMENT
            </h1>
            <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Manage boat records
            </p>
          </div>
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

        <BoatList
          boats={paginated}
          fisherfolk={fisherfolk}
          onEdit={handleEditBoat}
          onArchive={handleArchiveClick}
          onAssign={handleAssignClick}
          controls={(
            <>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700">Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {pageOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <div className="text-sm text-gray-600">Total: {filteredBoats.length}</div>
                <label className="ml-4 text-sm text-gray-700">Status:</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                  aria-label="Filter boats by status"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  Prev
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-1 rounded border text-sm ${currentPage === i + 1 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}
                    aria-label={`Page ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </>
          )}
        />

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

export default PABoatRegistryManagement;