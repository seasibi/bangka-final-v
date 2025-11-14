import React from 'react';
import PropTypes from 'prop-types';

const RegistrationDetails = ({ formData, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-blue-900">Registration Details</h2>
      </div>

      <div className="bg-white rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type of Ownership <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <select
                name="type_of_ownership"
                value={formData.type_of_ownership}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" disabled>Select Ownership Type</option>
                <option value="Single">Single</option>
                <option value="Shared">Shared</option>
                <option value="Corporate">Corporate</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
             Maximum Capacity <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="no_of_fishers"
                value={formData.no_of_fishers}
                onChange={onChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Homeport
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="Homeport"
                value={formData.homeport}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-not-allowed"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fisherfolk Name
            </label>
            <div className="mt-1">
              <input
                type="text"
                value={formData.fisherfolk_name}
                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Municipality
            </label>
            <div className="mt-1">
              <input
                type="text"
                value={formData.municipality}
                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-not-allowed"
                disabled
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

RegistrationDetails.propTypes = {
  formData: PropTypes.shape({
    type_of_ownership: PropTypes.string.isRequired,
    no_of_fishers: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    homeport: PropTypes.string.isRequired,
    fisherfolk_name: PropTypes.string.isRequired,
    municipality: PropTypes.string.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default RegistrationDetails; 