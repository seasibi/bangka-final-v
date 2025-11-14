import React from 'react';
import PropTypes from 'prop-types';
import { IoCloudUploadOutline } from 'react-icons/io5';

const BoatDimensions = ({ formData, onChange }) => {
  const limits = {
    registered_length: { min: 20, max: 25 },
    registered_breadth: { min: 16, max: 20 },
    registered_depth: { min: 20, max: 26 },
  };

  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    if (!(name in limits)) {
      onChange(e);
      return;
    }
    if (value === "") {
      onChange(e);
      return;
    }
    const numValue = parseFloat(value);
    const { min, max } = limits[name];
    if (!isNaN(numValue)) {
      // Clamp value to min/max
      let clamped = Math.max(min, Math.min(max, numValue));
      if (clamped !== numValue) {
        // If out of bounds, set to clamped value
        e.target.value = clamped;
      }
      if (clamped >= min && clamped <= max) {
        onChange(e);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-blue-900">Boat Dimensions</h2>
      </div>

      <div className="bg-white rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registered Length (meters) <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="registered_length"
                value={formData.registered_length}
                onChange={handleNumericChange}
                min="20"
                max="25"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registered Breadth (meters) <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="registered_breadth"
                value={formData.registered_breadth}
                onChange={handleNumericChange}
                min="16"
                max="20"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registered Depth (meters) <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="registered_depth"
                value={formData.registered_depth}
                onChange={handleNumericChange}
                min="20"
                max="26"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Optional Image Upload */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Boat Image <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            name="boat_image"
            onChange={onChange}
            accept="image/*"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
          <p className="mt-1 text-xs text-gray-500">Upload a clear photo of the boat.</p>
          {formData.boat_image && typeof formData.boat_image !== "string" && (
            <div className="mt-4">
              <img
                src={URL.createObjectURL(formData.boat_image)}
                alt="Boat Preview"
                className="w-48 h-32 object-cover rounded border border-gray-200"
              />
            </div>
          )}
          {formData.boat_image && typeof formData.boat_image === "string" && (
            <div className="mt-4">
              <img
                src={formData.boat_image}
                alt="Boat Preview"
                className="w-48 h-32 object-cover rounded border border-gray-200"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

BoatDimensions.propTypes = {
  formData: PropTypes.shape({
    RegisteredLength: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    RegisteredBreadth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    RegisteredDepth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    boat_image: PropTypes.any
  }).isRequired,
  onChange: PropTypes.func.isRequired
};

export default BoatDimensions;