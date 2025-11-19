import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';
import ConfirmModal from '../../components/ConfirmModal';
import SuccessModal from '../../components/SuccessModal';
import {
  getSignatories,
  createSignatory,
  updateSignatory,
  getAssignedSignatoryPositions
} from '../../services/signatoriesService';
import { getMunicipalities, getBarangays } from '../../services/municipalityService';

const SignatoriesManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [signatories, setSignatories] = useState([]);
  const [activeTab, setActiveTab] = useState('add');
  const [error, setError] = useState('');

  const SIGNATORY_POSITIONS = [
    'Provincial Agriculturist',
    'Municipal Agriculturist',
    'Municipal Fishery Coordinator',
    'Mayor'
  ];

  const [addForm, setAddForm] = useState({
    municipality_id: '', barangay_id: '', position: '',
    first_name: '', middle_name: '', last_name: ''
  });

  const [editForm, setEditForm] = useState({
    id: null, municipality_id: '', barangay_id: '', position: '',
    first_name: '', middle_name: '', last_name: '', is_active: true
  });

  const [selectedSignatory, setSelectedSignatory] = useState(null);
  const [assignedPositions, setAssignedPositions] = useState([]);
  const [filteredSignatories, setFilteredSignatories] = useState([]);
  const [filterMunicipality, setFilterMunicipality] = useState('all');
  const [filterBarangay, setFilterBarangay] = useState('all');
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    filterSignatoriesList();
  }, [signatories, filterMunicipality, filterBarangay]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [munData, sigData] = await Promise.all([getMunicipalities(), getSignatories()]);
      setMunicipalities(munData);
      setSignatories(sigData);
      setError('');
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // For a given position, return municipality IDs that already have that position assigned
  const getBlockedMunicipalityIdsByPosition = (position) => {
    const municipalPositions = ['Municipal Agriculturist', 'Municipal Fishery Coordinator', 'Mayor'];
    if (!position || !municipalPositions.includes(position)) return new Set();
    const blocked = new Set((signatories || []).filter(s => s.position === position && s.municipality_id).map(s => s.municipality_id));
    return blocked;
  };

  // Filtered municipalities list based on selected position
  const getMunicipalitiesForForm = () => {
    const scope = getScopeByPosition(addForm.position);
    if (scope !== 'municipality' && scope !== 'barangay') return municipalities;
    const blocked = getBlockedMunicipalityIdsByPosition(addForm.position);
    return (municipalities || []).filter(m => !blocked.has(m.municipality_id));
  };

  // Helper to extract readable error messages from DRF responses
  const formatApiError = (err) => {
    const data = err?.response?.data;
    if (!data) return 'Failed to add signatory';
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    // Collect field errors
    const messages = [];
    Object.entries(data).forEach(([field, val]) => {
      if (Array.isArray(val)) {
        messages.push(`${field}: ${val.join(', ')}`);
      } else if (typeof val === 'string') {
        messages.push(`${field}: ${val}`);
      }
    });
    return messages.join(' | ') || 'Failed to add signatory';
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
      const [assignedData, muniList, allList] = await Promise.all([
        getAssignedSignatoryPositions(municipalityId, barangayId),
        getSignatories({ municipality_id: municipalityId }),
        getSignatories()
      ]);
      const base = Array.isArray(assignedData) ? assignedData : (assignedData?.assigned_positions || []);
      const municipalPositions = ['Municipal Agriculturist', 'Municipal Fishery Coordinator', 'Mayor'];
      const assignedSet = new Set(base);
      (muniList || [])
        .filter(s => municipalPositions.includes(s.position))
        .forEach(s => assignedSet.add(s.position));
      if ((allList || []).some(s => s.position === 'Provincial Agriculturist')) {
        assignedSet.add('Provincial Agriculturist');
      }
      setAssignedPositions(Array.from(assignedSet));
    } catch (err) {
      console.error('Error fetching assigned positions:', err);
      setAssignedPositions([]);
    }
  };

  // Determine scope by position
  const getScopeByPosition = (position) => {
    if (position === 'Provincial Agriculturist') return 'province';
    if (['Municipal Agriculturist', 'Municipal Fishery Coordinator', 'Mayor'].includes(position)) return 'municipality';
    return 'barangay';
  };

  // Fetch global/province-level assigned positions only
  const fetchGlobalAssigned = async () => {
    try {
      const allList = await getSignatories();
      const assignedSet = new Set();
      if ((allList || []).some(s => s.position === 'Provincial Agriculturist')) {
        assignedSet.add('Provincial Agriculturist');
      }
      setAssignedPositions(Array.from(assignedSet));
    } catch (err) {
      console.error('Error fetching global assigned positions:', err);
      setAssignedPositions([]);
    }
  };

  const filterSignatoriesList = () => {
    let filtered = [...signatories];
    if (filterMunicipality !== 'all') filtered = filtered.filter(s => s.municipality_id === parseInt(filterMunicipality));
    if (filterBarangay !== 'all') filtered = filtered.filter(s => s.barangay_id === parseInt(filterBarangay));
    setFilteredSignatories(filtered);
  };

  const getAvailablePositions = () => SIGNATORY_POSITIONS.filter(pos => !assignedPositions.includes(pos));

  const fetchMunicipalityGlobalAssigned = async (municipalityId) => {
    try {
      const [muniList, allList] = await Promise.all([
        getSignatories({ municipality_id: municipalityId }),
        getSignatories()
      ]);
      const municipalPositions = ['Municipal Agriculturist', 'Municipal Fishery Coordinator', 'Mayor'];
      const assignedSet = new Set();
      (muniList || [])
        .filter(s => municipalPositions.includes(s.position))
        .forEach(s => assignedSet.add(s.position));
      if ((allList || []).some(s => s.position === 'Provincial Agriculturist')) {
        assignedSet.add('Provincial Agriculturist');
      }
      setAssignedPositions(Array.from(assignedSet));
    } catch (err) {
      console.error('Error fetching municipality/global assigned positions:', err);
      setAssignedPositions([]);
    }
  };

  const handleAddMunicipalityChange = async (e) => {
    const municipalityId = e.target.value;
    setAddForm(prev => ({ ...prev, municipality_id: municipalityId, barangay_id: '' }));
    setAssignedPositions([]);
    const scope = getScopeByPosition(addForm.position);
    if (municipalityId) {
      if (scope === 'barangay') {
        await fetchBarangaysForMunicipality(municipalityId);
      } else {
        setBarangays([]);
      }
      // For municipal scope, populate assigned positions for the municipality
      if (scope === 'municipality') {
        await fetchMunicipalityGlobalAssigned(municipalityId);
      }
    } else {
      setBarangays([]);
    }
  };

  const handleAddBarangayChange = async (e) => {
    const barangayId = e.target.value;
    setAddForm(prev => ({ ...prev, barangay_id: barangayId }));
    if (barangayId && addForm.municipality_id) await fetchAssignedPositions(addForm.municipality_id, barangayId);
    else setAssignedPositions([]);
  };

  const handleAddPositionChange = async (e) => {
    const position = e.target.value;
    const scope = getScopeByPosition(position);
    // Reset location fields when position changes
    setAddForm(prev => ({ ...prev, position, municipality_id: '', barangay_id: '' }));
    setBarangays([]);
    setAssignedPositions([]);
    if (scope === 'province') {
      await fetchGlobalAssigned();
    }
  };

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    const scope = getScopeByPosition(addForm.position);
    // Validate per scope
    if (!addForm.position || !addForm.first_name.trim() || !addForm.last_name.trim()) {
      setError('All required fields must be filled');
      return;
    }
    if (scope === 'municipality' && !addForm.municipality_id) {
      setError('Please select a municipality');
      return;
    }
    if (scope === 'barangay' && (!addForm.municipality_id || !addForm.barangay_id)) {
      setError('Please select municipality and barangay');
      return;
    }
    // Normalize legacy label values
    let normalizedPosition = addForm.position === 'Municipal' ? 'Municipal Agriculturist' : addForm.position;
    if (assignedPositions.includes(normalizedPosition)) {
      setError('Position is already assign');
      return;
    }
    const fullName = `${addForm.first_name.trim()} ${addForm.middle_name.trim()} ${addForm.last_name.trim()}`.replace(/\s+/g, ' ');
    const barangayName = barangays.find(b => b.barangay_id === parseInt(addForm.barangay_id))?.name || '';
    const municipalityName = municipalities.find(m => m.municipality_id === parseInt(addForm.municipality_id))?.name || '';
    const areaLabel = scope === 'province' ? 'the Province' : scope === 'municipality' ? municipalityName : barangayName;
    
    setConfirmModal({
      isOpen: true,
      title: 'Add Signatory',
      message: `Are you sure you want to add "${fullName}" as ${addForm.position}${areaLabel ? ` for ${areaLabel}` : ''}?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setError('');
          const payload = {
            position: normalizedPosition,
            first_name: addForm.first_name.trim(),
            middle_name: addForm.middle_name.trim(),
            last_name: addForm.last_name.trim()
          };
          if (addForm.municipality_id) payload.municipality = parseInt(addForm.municipality_id);
          if (addForm.barangay_id) payload.barangay = parseInt(addForm.barangay_id);
          await createSignatory(payload);
          setAddForm({ municipality_id: '', barangay_id: '', position: '', first_name: '', middle_name: '', last_name: '' });
          setBarangays([]);
          setAssignedPositions([]);
          await fetchInitialData();
          setSuccessModal({ isOpen: true, title: 'Success', message: `Signatory "${fullName}" has been added successfully!` });
        } catch (err) {
          setError(formatApiError(err));
          console.error('Add signatory failed:', err?.response?.data || err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSelectSignatory = async (signatory) => {
    setSelectedSignatory(signatory);
    setEditForm({
      id: signatory.id,
      municipality_id: signatory.municipality_id,
      barangay_id: signatory.barangay_id,
      position: signatory.position,
      first_name: signatory.first_name,
      middle_name: signatory.middle_name || '',
      last_name: signatory.last_name,
      is_active: signatory.is_active
    });
    setError('');
    await fetchBarangaysForMunicipality(signatory.municipality_id);
  };

  const handleCancelEdit = () => {
    if (!selectedSignatory) return;
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Changes',
      message: 'Are you sure you want to cancel? All unsaved changes will be lost.',
      onConfirm: () => {
        setEditForm({
          id: selectedSignatory.id,
          municipality_id: selectedSignatory.municipality_id,
          barangay_id: selectedSignatory.barangay_id,
          position: selectedSignatory.position,
          first_name: selectedSignatory.first_name,
          middle_name: selectedSignatory.middle_name || '',
          last_name: selectedSignatory.last_name,
          is_active: selectedSignatory.is_active
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
      title: 'Update Signatory',
      message: `Are you sure you want to update "${fullName}"?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setError('');
          await updateSignatory(editForm.id, {
            first_name: editForm.first_name.trim(),
            middle_name: editForm.middle_name.trim(),
            last_name: editForm.last_name.trim(),
            is_active: editForm.is_active
          });
          await fetchInitialData();
          const updated = signatories.find(s => s.id === editForm.id);
          if (updated) setSelectedSignatory(updated);
          setSuccessModal({ isOpen: true, title: 'Success', message: `Signatory "${fullName}" has been updated successfully!` });
        } catch (err) {
          setError(err.response?.data?.detail || 'Failed to update signatory');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading && signatories.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-6 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex items-center gap-4 mb-6">
          {/* back button */}
          <button type="button" onClick={() => navigate('/admin/utility')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>SIGNATORIES MANAGEMENT</h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Please fill out the form and confirm details to register a new signatories
            </p>
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
                <button onClick={() => setActiveTab('add')} className={`flex-1 px-6 py-4 font-medium transition-colors ${activeTab === 'add' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  ADD SIGNATORIES
                </button>
                <button onClick={() => setActiveTab('edit')} className={`flex-1 px-6 py-4 font-medium transition-colors ${activeTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
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
                        {SIGNATORY_POSITIONS.map(p => (
                          <option key={p} value={p} disabled={assignedPositions.includes(p)}>
                            {p}{assignedPositions.includes(p) ? ' (Assigned)' : ''}
                          </option>
                        ))}
                      </select>
                      {addForm.position && assignedPositions.includes(addForm.position) && (
                        <p className="mt-1 text-xs text-red-600">Position is already assign</p>
                      )}
                    </div>
                    {addForm.position && getScopeByPosition(addForm.position) !== 'province' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Municipality *</label>
                        <select value={addForm.municipality_id} onChange={handleAddMunicipalityChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                          <option value="">Select Municipality</option>
                          {getMunicipalitiesForForm().map(m => <option key={m.municipality_id} value={m.municipality_id}>{m.name}</option>)}
                        </select>
                      </div>
                    )}
                    {addForm.position && getScopeByPosition(addForm.position) === 'barangay' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Barangay *</label>
                        <select value={addForm.barangay_id} onChange={handleAddBarangayChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required disabled={!addForm.municipality_id}>
                          <option value="">Select Barangay</option>
                          {barangays.map(b => <option key={b.barangay_id} value={b.barangay_id}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                      <input type="text" value={addForm.first_name} onChange={(e) => setAddForm(prev => ({ ...prev, first_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Middle Initial</label>
                      <input
                        type="text"
                        value={addForm.middle_name}
                        maxLength={1}
                        onChange={(e) => {
                          const v = (e.target.value || '').toUpperCase().slice(0,1);
                          setAddForm(prev => ({ ...prev, middle_name: v }));
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
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
                  !selectedSignatory ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      <p className="text-gray-600">Select a signatory from the list to edit</p>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Middle Initial</label>
                        <input
                          type="text"
                          value={editForm.middle_name}
                          maxLength={1}
                          onChange={(e) => setEditForm(prev => ({ ...prev, middle_name: (e.target.value || '').toUpperCase().slice(0,1) }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                        <input type="text" value={editForm.last_name} onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div><label className="block text-sm font-medium text-gray-700">Signatory Status</label><p className="text-xs text-gray-500">Deactivate signatory if needed</p></div>
                        <button type="button" onClick={() => setEditForm(prev => ({ ...prev, is_active: !prev.is_active }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={handleCancelEdit} className="flex-1 py-3 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-300 hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{loading ? 'Updating...' : 'Update Signatory'}</button>
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
                <h3 className="text-lg font-semibold">Current List Of Signatories</h3>
              </div>

              

              <div className="grid grid-cols-2 gap-2 p-3 bg-blue-600 text-white font-semibold text-sm rounded-t-lg">
                <div>Full Name</div>
                <div>Position</div>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {(() => {
                  const list = signatories;
                  const groups = {};
                  list.forEach(s => {
                    const name = s.municipality_name || (municipalities.find(m => m.municipality_id === s.municipality_id)?.name || '—');
                    groups[name] = groups[name] || [];
                    groups[name].push(s);
                  });
                  return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([muni, rows]) => (
                    <div key={muni}>
                      <div className="px-3 py-2 bg-gray-100 text-gray-700 font-semibold text-xs uppercase tracking-wide">{muni}</div>
                      {rows.map(s => (
                        <button
                          key={s.id}
                          onClick={() => activeTab === 'edit' && handleSelectSignatory(s)}
                          className={`w-full grid grid-cols-2 gap-2 p-3 text-left text-sm transition-colors border ${
                            activeTab === 'edit' && selectedSignatory?.id === s.id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div>{`${s.first_name} ${s.middle_name ? (String(s.middle_name).charAt(0).toUpperCase() + '. ') : ''}${s.last_name}`}</div>
                          <div>{s.position}</div>
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

export default SignatoriesManagement;
