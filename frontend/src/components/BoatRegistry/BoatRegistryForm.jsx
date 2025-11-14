import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { createBoat, updateBoat, getBoatById } from '../../services/boatService';

const BoatRegistryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    boatId: '',
    fisherfolkId: '',
    street: '',
    barangay: '',
    municipality: '',
    ownershipType: '',
    boatName: '',
    boatType: '',
    is_active: true,
    placeBuilt: '',
    fisherCount: '',
    homeport: '',
    yearBuilt: '',
    materialUsed: '',
    registeredLength: '',
    registeredBreadth: '',
    registeredDepth: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBoatData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBoatById(id);
      setFormData(data);
    } catch {
      setError('Failed to fetch boat data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEditing) {
      fetchBoatData();
    }
  }, [isEditing, fetchBoatData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isEditing) {
        await updateBoat(id, formData);
      } else {
        await createBoat(formData);
      }
      navigate('/boat-registry');
    } catch {
      setError('Failed to save boat');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? 'Edit Boat' : 'Register New Boat'}
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Boat ID</label>
              <input
                type="text"
                name="boatId"
                value={formData.boatId}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fisherfolk ID</label>
              <input
                type="text"
                name="fisherfolkId"
                value={formData.fisherfolkId}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Boat Name</label>
              <input
                type="text"
                name="boatName"
                value={formData.boatName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Boat Type</label>
              <select
                name="boatType"
                value={formData.boatType}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Select Boat Type</option>
                <option value="motorized">Motorized</option>
                <option value="non-motorized">Non-motorized</option>
              </select>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Location Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Street</label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Barangay</label>
              <input
                type="text"
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Municipality</label>
              <input
                type="text"
                name="municipality"
                value={formData.municipality}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Homeport</label>
              <input
                type="text"
                name="homeport"
                value={formData.homeport}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Technical Specifications</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Registered Length</label>
                <input
                  type="number"
                  name="registeredLength"
                  value={formData.registeredLength}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Registered Breadth</label>
                <input
                  type="number"
                  name="registeredBreadth"
                  value={formData.registeredBreadth}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Engine Make</label>
              <input
                type="text"
                name="engineMake"
                value={formData.engineMake}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Horsepower</label>
              <input
                type="number"
                name="horsepower"
                value={formData.horsepower}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Fishing Methods */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Fishing Methods</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Marine Capture Methods</label>
              <textarea
                name="marineCaptureMethods"
                value={formData.marineCaptureMethods}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Inland Capture Methods</label>
              <textarea
                name="inlandCaptureMethods"
                value={formData.inlandCaptureMethods}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows="3"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/boat-registry')}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Boat' : 'Register Boat')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BoatRegistryForm; 