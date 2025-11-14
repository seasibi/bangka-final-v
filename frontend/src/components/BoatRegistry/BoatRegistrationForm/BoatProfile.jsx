import React from "react";
import PropTypes from "prop-types";

const BoatProfile = ({ formData, onChange, error }) => {
  const currentYear = new Date().getFullYear();

  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    if (name === "built_year") {
      const yearValue = parseInt(value);
      if (
        value === "" ||
        (!isNaN(yearValue) && yearValue >= 1900 && yearValue <= currentYear)
      ) {
        onChange(e);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-blue-900">Boat Profile</h2> 
      </div>

      <div className="bg-white rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Boat Name <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="boat_name"
                value={formData.boat_name}
                onChange={onChange}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  error ? "border-red-300" : ""
                }`}
                required
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Boat Type <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <select
                name="boat_type"
                value={formData.boat_type}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="motorized">Motorized</option>
                <option value="non-motorized">Non-motorized</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Material Used <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <select
                name="material_used"
                value={formData.material_used}
                onChange={onChange}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  error ? "border-red-300" : ""
                }`}
                required
              >
                <option value="" disabled>
                  Select Material Used
                </option>
                <option value="Wood">Wood</option>
                <option value="Fiber Glass">Fiber Glass</option>
                <option value="Composite">Composite</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Place Built <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="built_place"
                value={formData.built_place}
                onChange={onChange}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  error ? "border-red-300" : ""
                }`}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Year Built <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <input
                type="number"
                name="built_year"
                value={formData.built_year}
                onChange={handleNumericChange}
                min="1900"
                max={currentYear}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

BoatProfile.propTypes = {
  formData: PropTypes.shape({
    boat_name: PropTypes.string.isRequired,
    boat_type: PropTypes.string.isRequired,
    built_place: PropTypes.string.isRequired,
    built_year: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
      .isRequired,
    material_used: PropTypes.string.isRequired,
    // BoatImage removed from this step
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.bool,
};

export default BoatProfile;
