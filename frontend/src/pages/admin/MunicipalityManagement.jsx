import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Loader from '../../components/Loader';
import ConfirmModal from '../../components/ConfirmModal';
import SuccessModal from '../../components/SuccessModal';
import {
  getMunicipalities,
  createMunicipality,
  updateMunicipality,
  deleteMunicipality,
  createBarangay,
  updateBarangay,
  deleteBarangay
} from '../../services/municipalityService';

const MunicipalityManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [municipalities, setMunicipalities] = useState([]);
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'edit'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for Add Municipality
  const [addForm, setAddForm] = useState({
    name: '',
    color: '#3B82F6',
    identifier_icon: 'circle',
    is_coastal: false,
    barangays: []
  });

  // Form state for Edit Municipality
  const [editForm, setEditForm] = useState({
    municipality_id: null,
    name: '',
    color: '#3B82F6',
    identifier_icon: 'circle',
    is_coastal: false,
    is_active: true,
    barangays: []
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [barangayInput, setBarangayInput] = useState('');
  const [municipalityFilter, setMunicipalityFilter] = useState('all'); // 'all', 'active', 'inactive'
  
  // Modal states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: '',
    message: ''
  });
  const [barangayToRemove, setBarangayToRemove] = useState(null);

  useEffect(() => {
    fetchMunicipalities();
  }, []);

  const fetchMunicipalities = async () => {
    try {
      setLoading(true);
      const data = await getMunicipalities();
      console.log('Fetched municipalities with colors:', data.map(m => ({ name: m.name, color: m.color })));
      setMunicipalities(data);
      setError('');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to load municipalities';
      setError(errorMsg);
      console.error('Error fetching municipalities:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add Municipality Functions
  const handleAddBarangay = () => {
    const name = barangayInput.trim();
    if (!name) {
      setError('Barangay name cannot be empty');
      return;
    }

    // Check for duplicates
    const isDuplicate = addForm.barangays.some(
      b => b.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      setError('Barangay already added');
      return;
    }

    // Show confirmation modal
    setConfirmModal({
      isOpen: true,
      title: 'Add Barangay',
      message: `Are you sure you want to add "${name}" to the barangay list?`,
      onConfirm: () => {
        setAddForm(prev => ({
          ...prev,
          barangays: [...prev.barangays, { name, tempId: Date.now() }]
        }));
        setBarangayInput('');
        setError('');
        setSuccessModal({
          isOpen: true,
          title: 'Success',
          message: `Barangay "${name}" has been added successfully!`
        });
      }
    });
  };

  const handleRemoveBarangay = (barangay) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Barangay',
      message: `Are you sure you want to remove "${barangay.name}" from the list?`,
      onConfirm: () => {
        setAddForm(prev => ({
          ...prev,
          barangays: prev.barangays.filter(b => b.tempId !== barangay.tempId)
        }));
        setSuccessModal({
          isOpen: true,
          title: 'Success',
          message: `Barangay "${barangay.name}" has been removed successfully!`
        });
      }
    });
  };

  const validateMunicipalityName = (name) => {
    if (!name.trim()) {
      setError('Municipality name is required');
      return false;
    }

    // Check if name already exists (for add mode)
    if (activeTab === 'add') {
      const exists = municipalities.some(
        m => m.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (exists) {
        setError('A municipality with this name already exists');
        return false;
      }
    }

    // Check for duplicate in edit mode (excluding current municipality)
    if (activeTab === 'edit' && selectedMunicipality) {
      const exists = municipalities.some(
        m => m.municipality_id !== selectedMunicipality.municipality_id &&
             m.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (exists) {
        setError('A municipality with this name already exists');
        return false;
      }
    }

    return true;
  };

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    
    if (!validateMunicipalityName(addForm.name)) {
      return;
    }

    if (addForm.barangays.length === 0) {
      setError('Please add at least one barangay');
      return;
    }

    // Show confirmation modal
    setConfirmModal({
      isOpen: true,
      title: 'Add Municipality',
      message: `Are you sure you want to add "${addForm.name}" with ${addForm.barangays.length} barangay(s)?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setError('');

          // Create municipality
          const newMunicipality = await createMunicipality({
            name: addForm.name.trim(),
            color: addForm.color,
            identifier_icon: addForm.identifier_icon,
            is_coastal: !!addForm.is_coastal,
          });

          // Create barangays
          const barangayPromises = addForm.barangays.map(brgy =>
            createBarangay({
              name: brgy.name,
              municipality: newMunicipality.municipality_id
            })
          );

          await Promise.all(barangayPromises);

          const municipalityName = addForm.name.trim();
          const barangayCount = addForm.barangays.length;
          
          setAddForm({ name: '', color: '#3B82F6', identifier_icon: 'circle', is_coastal: false, barangays: [] });
          await fetchMunicipalities();

          setSuccessModal({
            isOpen: true,
            title: 'Success',
            message: `Municipality "${municipalityName}" with ${barangayCount} barangay(s) has been created successfully!`
          });
        } catch (err) {
          setError(err.response?.data?.name?.[0] || 'Failed to create municipality');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Edit Municipality Functions
  const handleSelectMunicipality = (municipality) => {
    setSelectedMunicipality(municipality);
    setEditForm({
      municipality_id: municipality.municipality_id,
      name: municipality.name,
      color: municipality.color,
      identifier_icon: municipality.identifier_icon || 'circle',
      is_coastal: !!municipality.is_coastal,
      is_active: municipality.is_active,
      barangays: municipality.barangays || []
    });
    setError('');
    setSuccess('');
    setBarangayInput('');
  };

  const handleCancelEdit = () => {
    if (!selectedMunicipality) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Changes',
      message: 'Are you sure you want to cancel? All unsaved changes will be lost.',
      onConfirm: () => {
        // Reset form to original municipality data
        setEditForm({
          municipality_id: selectedMunicipality.municipality_id,
          name: selectedMunicipality.name,
          color: selectedMunicipality.color,
          identifier_icon: selectedMunicipality.identifier_icon || 'circle',
          is_active: selectedMunicipality.is_active,
          barangays: selectedMunicipality.barangays || []
        });
        setBarangayInput('');
        setError('');
        setSuccess('');
        setSuccessModal({
          isOpen: true,
          title: 'Changes Cancelled',
          message: 'All changes have been reverted to the original values.'
        });
      }
    });
  };

  const handleAddBarangayToEdit = () => {
    const name = barangayInput.trim();
    if (!name) {
      setError('Barangay name cannot be empty');
      return;
    }

    // Check for duplicates
    const isDuplicate = editForm.barangays.some(
      b => b.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      setError('Barangay already exists');
      return;
    }

    // Show confirmation modal
    setConfirmModal({
      isOpen: true,
      title: 'Add Barangay',
      message: `Are you sure you want to add "${name}" to ${selectedMunicipality?.name || 'this municipality'}?`,
      onConfirm: () => {
        setEditForm(prev => ({
          ...prev,
          barangays: [...prev.barangays, { name, tempId: Date.now(), isNew: true }]
        }));
        setBarangayInput('');
        setError('');
        setSuccessModal({
          isOpen: true,
          title: 'Success',
          message: `Barangay "${name}" has been added successfully!`
        });
      }
    });
  };

  const handleRemoveBarangayFromEdit = (barangay) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Barangay',
      message: barangay.barangay_id 
        ? `Are you sure you want to permanently delete "${barangay.name}" from the database? This action cannot be undone.`
        : `Are you sure you want to remove "${barangay.name}" from the list?`,
      onConfirm: async () => {
        try {
          // If it has a barangay_id, delete from backend
          if (barangay.barangay_id) {
            await deleteBarangay(barangay.barangay_id);
          }

          // Remove from form
          setEditForm(prev => ({
            ...prev,
            barangays: prev.barangays.filter(b =>
              b.barangay_id ? b.barangay_id !== barangay.barangay_id : b.tempId !== barangay.tempId
            )
          }));

          setSuccessModal({
            isOpen: true,
            title: 'Success',
            message: `Barangay "${barangay.name}" has been ${barangay.barangay_id ? 'deleted' : 'removed'} successfully!`
          });
        } catch (err) {
          setError('Failed to delete barangay');
        }
      }
    });
  };

  const handleSubmitEdit = (e) => {
    e.preventDefault();

    if (!validateMunicipalityName(editForm.name)) {
      return;
    }

    if (editForm.barangays.length === 0) {
      setError('Municipality must have at least one barangay');
      return;
    }

    // Show confirmation modal
    setConfirmModal({
      isOpen: true,
      title: 'Update Municipality',
      message: `Are you sure you want to update "${selectedMunicipality?.name}" with these changes?`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setError('');

          // Update municipality
          await updateMunicipality(editForm.municipality_id, {
            name: editForm.name.trim(),
            color: editForm.color,
            identifier_icon: editForm.identifier_icon,
            is_coastal: !!editForm.is_coastal,
            is_active: editForm.is_active
          });

          // Create new barangays
          const newBarangays = editForm.barangays.filter(b => b.isNew);
          const barangayPromises = newBarangays.map(brgy =>
            createBarangay({
              name: brgy.name,
              municipality: editForm.municipality_id
            })
          );

          await Promise.all(barangayPromises);

          // Fetch fresh data
          const freshData = await getMunicipalities();
          setMunicipalities(freshData);

          // Refresh selected municipality with fresh data
          const updated = freshData.find(m => m.municipality_id === editForm.municipality_id);
          if (updated) {
            handleSelectMunicipality(updated);
          }

          setSuccessModal({
            isOpen: true,
            title: 'Success',
            message: `Municipality "${editForm.name}" has been updated successfully!`
          });
        } catch (err) {
          setError(err.response?.data?.name?.[0] || 'Failed to update municipality');
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading && municipalities.length === 0) {
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
          <button
            onClick={() => navigate('/admin/utility')}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Back to utility"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <PageTitle value="Municipality Management" />
            <p className="text-sm text-gray-600">Manage the municipalities of La Union</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-r">
            <p className="font-medium">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('add')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    activeTab === 'add'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ADD MUNICIPALITY
                </button>
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`flex-1 px-6 py-4 font-medium transition-colors ${
                    activeTab === 'edit'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  EDIT MUNICIPALITY
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'add' ? (
                  <form onSubmit={handleSubmitAdd} className="space-y-6">
                    {/* Municipality Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Municipality Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={(e) => {
                          setAddForm(prev => ({ ...prev, name: e.target.value }));
                          setError('');
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter municipality name"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Validate: Must be unique
                      </p>
                    </div>

                    {/* Auto-generated Prefix Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-blue-900">Auto-Generated Prefix</p>
                          <p className="text-xs text-blue-700 mt-1">
                            The registration prefix will be automatically generated from the first 3 letters of the municipality name (e.g., "Agoo" → "AGO")
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Map Identifier Icon */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Map Identifier Icon <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setAddForm(prev => ({ ...prev, identifier_icon: 'circle' }))}
                          className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
                            addForm.identifier_icon === 'circle'
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-blue-300'
                          }`}
                        >
                          <svg className="w-10 h-10 mb-2" viewBox="0 0 24 24" fill={addForm.identifier_icon === 'circle' ? '#2563eb' : '#9ca3af'}>
                            <circle cx="12" cy="12" r="8" />
                          </svg>
                          <span className={`text-sm font-medium ${addForm.identifier_icon === 'circle' ? 'text-blue-600' : 'text-gray-600'}`}>
                            Circle
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddForm(prev => ({ ...prev, identifier_icon: 'triangle' }))}
                          className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
                            addForm.identifier_icon === 'triangle'
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-blue-300'
                          }`}
                        >
                          <svg className="w-10 h-10 mb-2" viewBox="0 0 24 24" fill={addForm.identifier_icon === 'triangle' ? '#2563eb' : '#9ca3af'}>
                            <path d="M12 2L2 20h20L12 2z" />
                          </svg>
                          <span className={`text-sm font-medium ${addForm.identifier_icon === 'triangle' ? 'text-blue-600' : 'text-gray-600'}`}>
                            Triangle
                          </span>
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        All boats from this municipality will use this icon shape on the map
                      </p>
                    </div>

                    {/* Municipality Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Municipality Color <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={addForm.color}
                          onChange={(e) => setAddForm(prev => ({ ...prev, color: e.target.value }))}
                          className="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={addForm.color}
                          onChange={(e) => setAddForm(prev => ({ ...prev, color: e.target.value }))}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          placeholder="#3B82F6"
                          pattern="^#[0-9A-Fa-f]{6}$"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Color identifier for map visualization
                      </p>
                    </div>

                    {/* Coastal Municipality */}
                    <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                      <input
                        id="add_is_coastal"
                        type="checkbox"
                        checked={!!addForm.is_coastal}
                        onChange={(e) => setAddForm(prev => ({ ...prev, is_coastal: e.target.checked }))}
                        className="h-4 w-4 mt-1 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="ml-3">
                        <label htmlFor="add_is_coastal" className="text-sm font-medium text-gray-700">
                          Coastal Municipality
                        </label>
                        <p className="text-xs text-gray-500">Check if this municipality borders the sea.</p>
                      </div>
                    </div>

                    {/* Barangays */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Barangay Name <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={barangayInput}
                          onChange={(e) => setBarangayInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBarangay())}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter barangay name"
                        />
                        <button
                          type="button"
                          onClick={handleAddBarangay}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      {/* Barangay List */}
                      <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Barangays (in alphabetical order):
                        </p>
                        {addForm.barangays.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No barangays added yet</p>
                        ) : (
                          <div className="space-y-2">
                            {[...addForm.barangays].sort((a, b) => a.name.localeCompare(b.name)).map((brgy) => (
                              <div
                                key={brgy.tempId}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                              >
                                <span className="text-sm">{brgy.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBarangay(brgy)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Adding Municipality...' : 'Add Municipality'}
                    </button>
                  </form>
                ) : (
                  /* Edit Form */
                  <div>
                    {!selectedMunicipality ? (
                      <div className="text-center py-12">
                        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-gray-600">Select a municipality from the list to edit</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitEdit} className="space-y-6">
                        {/* Municipality Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Municipality Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => {
                              setEditForm(prev => ({ ...prev, name: e.target.value }));
                              setError('');
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter municipality name"
                          />
                        </div>

                        {/* Display Current Prefix (Read-only) */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Registration Prefix (Auto-generated)
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-mono text-lg font-bold text-blue-600">
                              {selectedMunicipality?.prefix || 'N/A'}
                            </span>
                            <div className="flex-1">
                              <p className="text-xs text-gray-600">
                                This prefix is automatically generated from the municipality name.
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {selectedMunicipality?.name && (
                                  <span>
                                    If you change the name, the prefix will update automatically.
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Map Identifier Icon */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Map Identifier Icon <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-4">
                            <button
                              type="button"
                              onClick={() => setEditForm(prev => ({ ...prev, identifier_icon: 'circle' }))}
                              className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
                                editForm.identifier_icon === 'circle'
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-gray-300 hover:border-blue-300'
                              }`}
                            >
                              <svg className="w-10 h-10 mb-2" viewBox="0 0 24 24" fill={editForm.identifier_icon === 'circle' ? '#2563eb' : '#9ca3af'}>
                                <circle cx="12" cy="12" r="8" />
                              </svg>
                              <span className={`text-sm font-medium ${editForm.identifier_icon === 'circle' ? 'text-blue-600' : 'text-gray-600'}`}>
                                Circle
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditForm(prev => ({ ...prev, identifier_icon: 'triangle' }))}
                              className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
                                editForm.identifier_icon === 'triangle'
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-gray-300 hover:border-blue-300'
                              }`}
                            >
                              <svg className="w-10 h-10 mb-2" viewBox="0 0 24 24" fill={editForm.identifier_icon === 'triangle' ? '#2563eb' : '#9ca3af'}>
                                <path d="M12 2L2 20h20L12 2z" />
                              </svg>
                              <span className={`text-sm font-medium ${editForm.identifier_icon === 'triangle' ? 'text-blue-600' : 'text-gray-600'}`}>
                                Triangle
                              </span>
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            All boats from this municipality will use this icon shape on the map
                          </p>
                        </div>

                        {/* Municipality Color */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Municipality Color <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="color"
                              value={editForm.color}
                              onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                              className="h-12 w-20 rounded-lg border border-gray-300 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={editForm.color}
                              onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                              placeholder="#3B82F6"
                              pattern="^#[0-9A-Fa-f]{6}$"
                            />
                          </div>
                        </div>

                        {/* Coastal Municipality */}
                        <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                          <input
                            id="edit_is_coastal"
                            type="checkbox"
                            checked={!!editForm.is_coastal}
                            onChange={(e) => setEditForm(prev => ({ ...prev, is_coastal: e.target.checked }))}
                            className="h-4 w-4 mt-1 text-blue-600 border-gray-300 rounded"
                          />
                          <div className="ml-3">
                            <label htmlFor="edit_is_coastal" className="text-sm font-medium text-gray-700">
                              Coastal Municipality
                            </label>
                            <p className="text-xs text-gray-500">Check if this municipality borders the sea.</p>
                          </div>
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Municipality Status
                            </label>
                            <p className="text-xs text-gray-500">Deactivate municipality if needed</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              editForm.is_active ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                editForm.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Barangays */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Barangays <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={barangayInput}
                              onChange={(e) => setBarangayInput(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBarangayToEdit())}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Add new barangay"
                            />
                            <button
                              type="button"
                              onClick={handleAddBarangayToEdit}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>

                          {/* Barangay List */}
                          <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Barangays (in alphabetical order):
                            </p>
                            {editForm.barangays.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No barangays</p>
                            ) : (
                              <div className="space-y-2">
                                {[...editForm.barangays].sort((a, b) => a.name.localeCompare(b.name)).map((brgy) => (
                                  <div
                                    key={brgy.barangay_id || brgy.tempId}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                                  >
                                    <span className="text-sm">{brgy.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBarangayFromEdit(brgy)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={loading}
                            className="flex-1 py-3 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {loading ? 'Updating...' : 'Update Municipality'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Municipality List / Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {activeTab === 'add' ? 'Review Details' : 'Select Municipality'}
                </h3>
                {activeTab === 'edit' && (
                  <button
                    onClick={fetchMunicipalities}
                    disabled={loading}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    title="Refresh municipalities"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>

              {activeTab === 'add' ? (
                /* Preview for Add */
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Municipality Name:</p>
                    <p className="text-gray-900 mt-1">{addForm.name || '—'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Color:</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{ backgroundColor: addForm.color }}
                      />
                      <span className="text-gray-900 font-mono">{addForm.color}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Barangays:</p>
                    <p className="text-gray-900 mt-1">{addForm.barangays.length} barangay(s)</p>
                  </div>
                </div>
              ) : (
                /* Municipality List for Edit */
                <>
                  {/* Filter Dropdown */}
                  <div className="mb-4">
                    <select
                      value={municipalityFilter}
                      onChange={(e) => setMunicipalityFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Municipalities</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {(() => {
                      const filteredMunicipalities = municipalities.filter(m => {
                        if (municipalityFilter === 'active') return m.is_active;
                        if (municipalityFilter === 'inactive') return !m.is_active;
                        return true;
                      });

                      if (filteredMunicipalities.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="text-sm">
                              {municipalityFilter === 'active' && 'No active municipalities found'}
                              {municipalityFilter === 'inactive' && 'No inactive municipalities found'}
                              {municipalityFilter === 'all' && 'No municipalities found'}
                            </p>
                          </div>
                        );
                      }

                      return filteredMunicipalities.map((municipality) => (
                        <button
                          key={municipality.municipality_id}
                          onClick={() => handleSelectMunicipality(municipality)}
                          className={`w-full text-left p-3 rounded-lg transition-colors border ${
                            selectedMunicipality?.municipality_id === municipality.municipality_id
                              ? 'bg-blue-50 border-blue-500'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-6 h-6 rounded border border-gray-300"
                                style={{ backgroundColor: municipality.color }}
                              />
                              <div>
                                <p className="font-medium text-gray-900">{municipality.name}</p>
                                <p className="text-xs text-gray-500">
                                  {municipality.barangay_count} barangay(s)
                                </p>
                              </div>
                            </div>
                            {!municipality.is_active && (
                              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  );
};

export default MunicipalityManagement;
