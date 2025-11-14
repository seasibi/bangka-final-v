import React from "react";

const GearSection = ({ 
  label, 
  mainField, 
  formData, 
  handleInputChange,
  subItems = [],          // flat list
  subItemGroups = []      // grouped list
}) => {
  return (
    <div className="border border-black rounded-lg shadow-sm">
      {/* Header with main checkbox */}
      <label
        className="flex items-center justify-between p-3 cursor-pointer select-none"
        htmlFor={mainField}
      >
        <div className="flex items-center space-x-2">
          <input
            id={mainField}
            type="checkbox"
            name={mainField}
            checked={formData[mainField] === true}
            onChange={(e) => {
              handleInputChange({
                target: { name: mainField, value: e.target.checked },
              });
              if (!e.target.checked) {
                // Reset sub-items and groups
                subItems.forEach((item) => {
                  handleInputChange({ target: { name: item.field, value: false } });
                  if (item.quantityField) {
                    handleInputChange({ target: { name: item.quantityField, value: "" } });
                  }
                });
                subItemGroups.forEach((group) => {
                  group.items.forEach((item) => {
                    handleInputChange({ target: { name: item.field, value: false } });
                    if (item.quantityField) {
                      handleInputChange({ target: { name: item.quantityField, value: "" } });
                    }
                  });
                });
              }
            }}
            className="form-checkbox text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-700 font-medium text-sm">{label}</span>
        </div>
        {/* Expand/Collapse Icon */}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            formData[mainField] ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </label>

      {/* Sub-items */}
      {formData[mainField] && (
        <div className="px-6 pb-4">
          {/* Flat list */}
          {subItems.length > 0 && subItems.map((item) => (
            <label key={item.field} className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                name={item.field}
                checked={formData[item.field] === true}
                onChange={(e) => {
                  handleInputChange({ target: { name: item.field, value: e.target.checked } });
                  if (!e.target.checked && item.quantityField) {
                    handleInputChange({ target: { name: item.quantityField, value: "" } });
                  }
                }}
                className="form-checkbox text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 text-sm">{item.label}</span>
              {formData[item.field] && item.quantityField && (
                <input
                  type="number"
                  name={item.quantityField}
                  value={formData[item.quantityField] || ""}
                  onChange={handleInputChange}
                  placeholder="Enter quantity"
                  min={1}
                  className="block w-20 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm ml-auto"
                />
              )}
            </label>
          ))}

          {/* Grouped list */}
          {subItemGroups.length > 0 && subItemGroups.map((group, gi) => (
            <div key={gi} className="mb-4">
              {group.sectionLabel && (
                <span className="block text-gray-700 text-sm font-medium mb-1">
                  {group.sectionLabel}
                </span>
              )}
              {group.items.map((item) => (
                <label key={item.field} className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    name={item.field}
                    checked={formData[item.field] === true}
                    onChange={(e) => {
                      handleInputChange({ target: { name: item.field, value: e.target.checked } });
                      if (!e.target.checked && item.quantityField) {
                        handleInputChange({ target: { name: item.quantityField, value: "" } });
                      }
                    }}
                    className="form-checkbox text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 text-sm">{item.label}</span>
                  {formData[item.field] && item.quantityField && (
                    <input
                      type="number"
                      name={item.quantityField}
                      value={formData[item.quantityField] || ""}
                      onChange={handleInputChange}
                      placeholder="Enter quantity"
                      min={1}
                      className="block w-20 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm ml-auto"
                    />
                  )}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GearSection;
