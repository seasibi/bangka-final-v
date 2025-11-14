import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import BoatList from '../../components/BoatRegistry/BoatList';
import {
  getBoatsByMunicipality,
  getBoatById,
  archiveFisherfolkBoat
} from '../../services/boatService';
import { getFisherfolk } from '../../services/fisherfolkService';
import { getTrackers, assignTrackerToBoat } from '../../services/trackerService';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Loader from '../../components/Loader';
import { useAuth } from '../../contexts/AuthContext';

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

const MABoatRegistryManagement = () => {
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
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ get user info including municipality


  useEffect(() => {
    if (user?.municipality) {
      fetchBoats(normalizeMunicipality(user.municipality));
    }
  }, [user?.municipality]);

  const fetchBoats = async (municipality) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch boats for the user's municipality only
      const boatsData = await getBoatsByMunicipality(normalizeMunicipality(municipality || ''));
      const fisherfolkData = await getFisherfolk();

      const list = Array.isArray(boatsData) ? boatsData : (boatsData?.results || []);
      setBoats(list);
      setFisherfolk(fisherfolkData);
    } catch (err) {
      console.error('Error fetching boats by municipality:', err);
      setError('Failed to fetch boats');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBoat = () => navigate('/admin/boat-registry/add');
  const handleEditBoat = (boatId) => navigate(`/admin/boat-registry/edit/${boatId}`);

  const handleArchiveClick = (boatregId) => {
    const boat = boats.find(b => b.boat_registry_no === boatregId);
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
      setSuccess(`Boat "${selectedBoat.boat_name}" has been archived.`);
      setIsArchiveModalOpen(false);
  await fetchBoats(user?.municipality);
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

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex justify-between items-center mb-6">
          <PageTitle value="Boat Registry Management" />
          <Button
            onClick={handleAddBoat}
            style={{ backgroundColor: '#3863CF', fontFamily: 'Montserrat, sans-serif' }}
          >
            Add New Boat
          </Button>
        </div>

        {error && <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
        {success && <div className="mb-4 p-4 text-green-700 bg-green-100 rounded-lg">{success}</div>}

        <BoatList
          boats={boats}
          fisherfolk={fisherfolk}
          onEdit={handleEditBoat}
          onArchive={handleArchiveClick}
          onAssign={handleAssignClick}
        />

        <Modal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          onConfirm={handleArchiveConfirm}
          title="Archive Boat"
          message={`Are you sure you want to archive the boat "${selectedBoat?.boat_name}"?`}
          confirmText="Archive"
          cancelText="Cancel"
        />

        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          onConfirm={async () => {
            await assignTrackerToBoat(selectedAssignBoat.mfbr_number, selectedTrackerId);
            setIsAssignModalOpen(false);
            setSelectedTrackerId('');
            setSelectedAssignBoat(null);
            await fetchBoats(user?.municipality);
          }}
          title="Assign Tracker"
          message={
            assignTrackers.length === 0
              ? 'No available trackers for this municipality.'
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
          confirmText={assignTrackers.length === 0 ? '' : 'Assign'}
          cancelText="Cancel"
        />
      </div>
    </div>
  );
};

export default MABoatRegistryManagement;