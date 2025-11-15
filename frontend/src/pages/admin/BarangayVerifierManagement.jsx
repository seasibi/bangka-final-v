import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';
import ConfirmModal from '../../components/ConfirmModal';
import SuccessModal from '../../components/SuccessModal';
import {
  getBarangayVerifiers,
  createBarangayVerifier,
  updateBarangayVerifier,
  getAssignedPositions
} from '../../services/barangayVerifierService';
import { getMunicipalities, getBarangays } from '../../services/municipalityService';

const BarangayVerifierManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [verifiers, setVerifiers] = useState([]);
  const [activeTab, setActiveTab] = useState('add');
  const [error, setError] = useState('');

  const VERIFIER_POSITIONS = ['Barangay Captain', 'Barangay Secretary', 'Fishing Coordinator'];

  const [addForm, setAddForm] = useState({
    municipality_id: '', barangay_id: '', position: '',
    first_name: '', middle_name: '', last_name: ''
  });

  const [editForm, setEditForm] = useState({
    id: null, municipality_id: '', barangay_id: '', position: '',
    first_name: '', middle_name: '', last_name: '', is_active: true
  });

  const [selectedVerifier, setSelectedVerifier] = useState(null);
  const [assignedPositions, setAssignedPositions] = useState([]);
  const [filteredVerifiers, setFilteredVerifiers] = useState([]);
  const [filterMunicipality, setFilterMunicipality] = useState('all');
  const [filterBarangay, setFilterBarangay] = useState('all');
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    filterVerifiersList();
  }, [verifiers, filterMunicipality, filterBarangay]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [munData, verData] = await Promise.all([getMunicipalities(), getBarangayVerifiers()]);
      setMunicipalities(munData);
      setVerifiers(verData);
      setError('');
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute barangay_ids in a municipality where a position is already assigned
  const getBlockedBarangayIdsByPosition = (municipalityId, position) => {
    if (!municipalityId || !position) return new Set();
    const blocked = new Set(
      (verifiers || [])
        .filter(v => v.municipality_id === parseInt(municipalityId) && v.position === position)
        .map(v => v.barangay_id)
    );
    return blocked;
  };

  // Municipalities that have at least one barangay available for the selected position
  const getAvailableMunicipalitiesForForm = () => {
    if (!addForm.position) return municipalities;
    const avail = (municipalities || []).filter(m => {
      const munBarangays = m.barangays || [];
      const blocked = getBlockedBarangayIdsByPosition(m.municipality_id, addForm.position);
      return munBarangays.some(b => !blocked.has(b.barangay_id));
    });
    return avail;
  };

  // Barangays for selected municipality filtered by position availability
  const getAvailableBarangaysForForm = () => {
    if (!addForm.municipality_id) return [];
    const blocked = getBlockedBarangayIdsByPosition(addForm.municipality_id, addForm.position);
    return (barangays || []).filter(b => !blocked.has(b.barangay_id));
  };

  const fetchBarangaysForMunicipality = async (municipalityId) => {
    try {
      const data = await getBarangays({ municipality_id: municipalityId });
      setBarangays(data);
    } catch (err) {
      console.error('Error fetching barangays:', err);
      setBarangays([]);
    }
  };

  const fetchAssignedPositions = async (municipalityId, barangayId) => {
    try {
      const data = await getAssignedPositions(municipalityId, barangayId);
      setAssignedPositions(Array.isArray(data) ? data : (data?.assigned_positions || []));
    } catch (err) {
      console.error('Error fetching assigned positions:', err);
      setAssignedPositions([]);
    }
  };

  const filterVerifiersList = () => {
    let filtered = [...verifiers];
    if (filterMunicipality !== 'all') filtered = filtered.filter(v => v.municipality_id === parseInt(filterMunicipality));
    if (filterBarangay !== 'all') filtered = filtered.filter(v => v.barangay_id === parseInt(filterBarangay));
    setFilteredVerifiers(filtered);
  };

  const getAvailablePositions = () => VERIFIER_POSITIONS.filter(pos => !assignedPositions.includes(pos));

  const handleAddMunicipalityChange = async (e) => {
    const municipalityId = e.target.value;
    setAddForm(prev => ({ ...prev, municipality_id: municipalityId, barangay_id: '' }));
    setAssignedPositions([]);
    if (municipalityId) await fetchBarangaysForMunicipality(municipalityId);
    else setBarangays([]);
  };

  const handleAddBarangayChange = async (e) => {
    const barangayId = e.target.value;
    setAddForm(prev => ({ ...prev, barangay_id: barangayId }));
    if (barangayId && addForm.municipality_id) await fetchAssignedPositions(addForm.municipality_id, barangayId);
    else setAssignedPositions([]);
  };

  const handleAddPositionChange = async (e) => {
    const position = e.target.value;
    // Reset dependent fields when position changes
    setAddForm(prev => ({ ...prev, position, municipality_id: '', barangay_id: '' }));
    setBarangays([]);
    setAssignedPositions([]);
  };

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    if (!addForm.municipality_id || !addForm.barangay_id || !addForm.position || !addForm.first_name.trim() || !addForm.last_name.trim()) {
      setError('All required fields must be filled');
      return;
    }
    if (assignedPositions.includes(addForm.position)) {
      setError('Position is already assign');
      return;
    }
    const fullName = `${addForm.first_name.trim()} ${addForm.middle_name.trim()} ${addForm.last_name.trim()}`.replace(/\s+/g, ' ');
    const barangayName = barangays.find(b => b.barangay_id === parseInt(addForm.barangay_id))?.name || '';
    
    setConfirmModal({
      isOpen: true,
      title: 'Add Barangay Verifier',
      message: `Are you sure you want to add "${fullName}" as ${addForm.position} for ${barangayName}?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setError('');
          await createBarangayVerifier({
            municipality: parseInt(addForm.municipality_id),
            barangay: parseInt(addForm.barangay_id),
            position: addForm.position,
            first_name: addForm.first_name.trim(),
            middle_name: addForm.middle_name.trim(),
            last_name: addForm.last_name.trim()
          });
          setAddForm({ municipality_id: '', barangay_id: '', position: '', first_name: '', middle_name: '', last_name: '' });
          setBarangays([]);
          setAssignedPositions([]);
          await fetchInitialData();
          setSuccessModal({ isOpen: true, title: 'Success', message: `Barangay Verifier "${fullName}" has been added successfully!` });
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to add barangay verifier');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSelectVerifier = async (verifier) => {
    setSelectedVerifier(verifier);
    setEditForm({
      id: verifier.id,
      municipality_id: verifier.municipality_id,
      barangay_id: verifier.barangay_id,
      position: verifier.position,
      first_name: verifier.first_name,
      middle_name: verifier.middle_name || '',
      last_name: verifier.last_name,
      is_active: verifier.is_active
    });
    setError('');
    await fetchBarangaysForMunicipality(verifier.municipality_id);
  };

  const handleCancelEdit = () => {
    if (!selectedVerifier) return;
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Changes',
      message: 'Are you sure you want to cancel? All unsaved changes will be lost.',
      onConfirm: () => {
        setEditForm({
          id: selectedVerifier.id,
          municipality_id: selectedVerifier.municipality_id,
          barangay_id: selectedVerifier.barangay_id,
          position: selectedVerifier.position,
          first_name: selectedVerifier.first_name,
          middle_name: selectedVerifier.middle_name || '',
          last_name: selectedVerifier.last_name,
          is_active: selectedVerifier.is_active
        });
        setError('');
        setSuccessModal({ isOpen: true, title: 'Changes Cancelled', message: 'All changes have been reverted.' });
      }
    });
  };

  const handleSubmitEdit = (e) => {
    e.preventDefault();
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      setError('First Name and Last Name are required');
      return;
    }
    const fullName = `${editForm.first_name.trim()} ${editForm.middle_name.trim()} ${editForm.last_name.trim()}`.replace(/\s+/g, ' ');
    
    setConfirmModal({
      isOpen: true,
      title: 'Update Barangay Verifier',
      message: `Are you sure you want to update "${fullName}"?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setError('');
          await updateBarangayVerifier(editForm.id, {
            first_name: editForm.first_name.trim(),
            middle_name: editForm.middle_name.trim(),
            last_name: editForm.last_name.trim(),
            is_active: editForm.is_active
          });
          await fetchInitialData();
          const updated = verifiers.find(v => v.id === editForm.id);
          if (updated) setSelectedVerifier(updated);
          setSuccessModal({ isOpen: true, title: 'Success', message: `Barangay Verifier "${fullName}" has been updated successfully!` });
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to update barangay verifier');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading && verifiers.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-6 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin/utility')} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <PageTitle value="VERIFIER MANAGEMENT" />
            <p className="text-sm text-gray-600">Please fill out the form and confirm details to register a new barangay verifier</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('add')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${activeTab === 'add' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  ADD VERIFIER
                </button>
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${activeTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  EDIT VERIFIER
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'add' ? (
                  <form onSubmit={handleSubmitAdd} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Position *</label>
                      <select value={addForm.position} onChange={handleAddPositionChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                        <option value="">Select Position</option>
                        {VERIFIER_POSITIONS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    {addForm.position && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Municipality *</label>
                        <select value={addForm.municipality_id} onChange={handleAddMunicipalityChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                          <option value="">Select Municipality</option>
                          {getAvailableMunicipalitiesForForm().map(m => <option key={m.municipality_id} value={m.municipality_id}>{m.name}</option>)}
                        </select>
                      </div>
                    )}
                    {addForm.position && addForm.municipality_id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Barangay *</label>
                        <select value={addForm.barangay_id} onChange={handleAddBarangayChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                          <option value="">Select Barangay</option>
                          {getAvailableBarangaysForForm().map(b => <option key={b.barangay_id} value={b.barangay_id}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input type="text" value={addForm.first_name} onChange={(e) => setAddForm(prev => ({ ...prev, first_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                      <input type="text" value={addForm.middle_name} onChange={(e) => setAddForm(prev => ({ ...prev, middle_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                      <input type="text" value={addForm.last_name} onChange={(e) => setAddForm(prev => ({ ...prev, last_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                      {loading ? 'Adding...' : 'ADD'}
                    </button>
                  </form>
                ) : (
                  !selectedVerifier ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      <p className="text-gray-600">Select a verifier from the list to edit</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitEdit} className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Assignment Information</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><p className="text-blue-700 font-medium">Municipality:</p><p className="text-blue-900">{municipalities.find(m => m.municipality_id === editForm.municipality_id)?.name || 'N/A'}</p></div>
                          <div><p className="text-blue-700 font-medium">Barangay:</p><p className="text-blue-900">{barangays.find(b => b.barangay_id === editForm.barangay_id)?.name || 'N/A'}</p></div>
                          <div><p className="text-blue-700 font-medium">Position:</p><p className="text-blue-900">{editForm.position}</p></div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                        <input type="text" value={editForm.first_name} onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                        <input type="text" value={editForm.middle_name} onChange={(e) => setEditForm(prev => ({ ...prev, middle_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                        <input type="text" value={editForm.last_name} onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div><label className="block text-sm font-medium text-gray-700">Verifier Status</label><p className="text-xs text-gray-500">Deactivate verifier if needed</p></div>
                        <button type="button" onClick={() => setEditForm(prev => ({ ...prev, is_active: !prev.is_active }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={handleCancelEdit} className="flex-1 py-3 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-300 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Updating...' : 'Update Verifier'}</button>
                      </div>
                    </form>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <h3 className="text-lg font-semibold">Current List Of Barangay Verifiers for {filterMunicipality !== 'all' ? municipalities.find(m => m.municipality_id === parseInt(filterMunicipality))?.name : 'All'}, {filterBarangay !== 'all' ? 'Barangay ' + municipalities.find(m => m.municipality_id === parseInt(filterMunicipality))?.barangays?.find(b => b.barangay_id === parseInt(filterBarangay))?.name : ''}</h3>
              </div>

              {activeTab === 'edit' && (
                <div className="space-y-3 mb-4">
                  <select value={filterMunicipality} onChange={(e) => { setFilterMunicipality(e.target.value); setFilterBarangay('all'); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="all">All Municipalities</option>
                    {municipalities.map(m => <option key={m.municipality_id} value={m.municipality_id}>{m.name}</option>)}
                  </select>
                  {filterMunicipality !== 'all' && (
                    <select value={filterBarangay} onChange={(e) => setFilterBarangay(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="all">All Barangays</option>
                      {municipalities.find(m => m.municipality_id === parseInt(filterMunicipality))?.barangays?.map(b => <option key={b.barangay_id} value={b.barangay_id}>{b.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 p-3 bg-blue-600 text-white font-semibold text-sm rounded-t-lg">
                <div>Full Name</div>
                <div>Position</div>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {(() => {
                  const list = activeTab === 'add' ? verifiers : filteredVerifiers;
                  const groups = {};
                  (list || []).forEach(v => {
                    const muni = v.municipality_name || (municipalities.find(m => m.municipality_id === v.municipality_id)?.name || '—');
                    groups[muni] = groups[muni] || [];
                    groups[muni].push(v);
                  });
                  return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([muni, rows]) => (
                    <div key={muni}>
                      <div className="px-3 py-2 bg-gray-100 text-gray-700 font-semibold text-xs uppercase tracking-wide">{muni}</div>
                      {rows.map(v => (
                        <button
                          key={v.id}
                          onClick={() => activeTab === 'edit' && handleSelectVerifier(v)}
                          className={`w-full grid grid-cols-2 gap-2 p-3 text-left text-sm transition-colors border ${
                            activeTab === 'edit' && selectedVerifier?.id === v.id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div>{`${v.first_name} ${v.middle_name ? v.middle_name + ' ' : ''}${v.last_name}`}</div>
                          <div>{v.position}</div>
                        </button>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={/delete|remove|deactivate/i.test(confirmModal.title || '') ? 'danger' : 'primary'}
      />
      <SuccessModal isOpen={successModal.isOpen} onClose={() => setSuccessModal({ ...successModal, isOpen: false })} title={successModal.title} message={successModal.message} />
    </div>
  );
};

export default BarangayVerifierManagement;
