import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { logActivity } from "../../utils/activityLog";
import {
  updateBoat,
  updateFisherfolkBoat,
  createBoatMeasurements,
  updateBoatMeasurements,
} from "../../services/boatService";
import Modal from "../Modal";
import SuccessModal from "../SuccessModal";
import ConfirmModal from "../ConfirmModal";

const BoatForm = ({ initialData, isEditing }) => {
  const navigate = useNavigate();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formData, setFormData] = useState(
    initialData || {
      boat_registry_no: "",
      boat_id: "",
      boat_name: "",
      boat_type: "",
      fisherfolk_number: "",
      is_active: "",
      barangay: "",
      municipality: "",
      homeport: "",
      ownership_type: "",
      built_place: "",
      built_year: "",
      no_of_fishers: "",
      material_used: "",
      registered_length: "",
      registered_breadth: "",
      registered_depth: "",
    }
  );

  const ownershipOptions = ["Individual", "Group"];
  const boatTypeOptions = ["Motorized", "Non-Motorized"];
  const statusOptions = [
    { value: true, label: "Active" },
    { value: false, label: "Inactive" },
  ];

  const dimensionLimits = {
    registered_length: { min: 20, max: 25 },
    registered_breadth: { min: 0.75, max: 0.8 },
    registered_depth: { min: 0.75, max: 0.8 },
  };

  const validateForm = () => {
    const requiredFields = [
      "boat_name",
      "boat_type",
      "fisherfolk_number",
      "is_active",
      "barangay",
      "municipality",
      "homeport",
      "ownership_type",
      "built_place",
      "no_of_fishers",
      "built_year",
      "material_used",
      "registered_length",
      "registered_breadth",
      "registered_depth",
    ];

    // Only require boat_registry_no for new boats
    if (!isEditing) {
      requiredFields.unshift("boat_registry_no");
    }

    const missingFields = requiredFields.filter((field) => {
      const value = formData[field];
      return (
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && value.trim() === "")
      );
    });

    if (missingFields.length > 0) {
      setSubmitError(
        `Please fill in all required fields: ${missingFields
          .map((field) => field.replace(/_/g, " "))
          .join(", ")}`
      );
      return false;
    }

    // Validate numeric fields
    const requiredNumericFields = [
      "no_of_fishers",
      "built_year",
      "registered_length",
      "registered_breadth",
      "registered_depth",
    ];

    // Validate required numeric fields
    for (const field of requiredNumericFields) {
      const value = formData[field];
      const numValue = Number(value);

      if (isNaN(numValue)) {
        setSubmitError(`${field.replace(/_/g, " ")} must be a valid number`);
        return false;
      }

      if (numValue <= 0) {
        setSubmitError(`${field.replace(/_/g, " ")} must be greater than 0`);
        return false;
      }
    }

    // Additional constraints for registered dimensions
    const lengthVal = Number(formData.registered_length);
    const breadthVal = Number(formData.registered_breadth);
    const depthVal = Number(formData.registered_depth);

    if (lengthVal < 20 || lengthVal > 25) {
      setSubmitError("registered length must be between 20 and 25");
      return false;
    }
    if (breadthVal < 0.75 || breadthVal > 0.8) {
      setSubmitError("registered breadth must be between 0.75 and 0.80");
      return false;
    }
    if (depthVal < 0.75 || depthVal > 0.8) {
      setSubmitError("registered depth must be between 0.75 and 0.80");
      return false;
    }

    // Validate year
    const year = Number(formData.built_year);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      setSubmitError(`Year built must be between 1900 and ${currentYear}`);
      return false;
    }

    // Validate boat type
    if (!["Motorized", "Non-Motorized"].includes(formData.boat_type)) {
      setSubmitError("Invalid boat type");
      return false;
    }

    // Validate status
    console.log("is_active:", formData.is_active);
    if (![true, false].includes(formData.is_active)) {
      setSubmitError("Invalid status");
      return false;
    }

    return true;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let processedValue = value;

    if (name === "is_active") {
      processedValue = value === "true"; // convert string to boolean
    }

    if (type === "number") {
      if (value === "") {
        processedValue = "";
      } else if (name in dimensionLimits) {
        const numValue = parseFloat(value);
        const { min, max } = dimensionLimits[name];
        if (!isNaN(numValue)) {
          const clamped = Math.max(min, Math.min(max, numValue));
          processedValue = String(clamped);
        }
      } else {
        processedValue = value;
      }
    }

    if (
      (type === "text" || type === "select-one") &&
      typeof processedValue === "string"
    ) {
      processedValue = processedValue.trim();
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    setSubmitError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted! Current formData:", formData);
    setSubmitError(null);
    const isValid = validateForm();
    console.log("Validation result:", isValid);
    if (isValid) {
      console.log("Validation passed, showing confirmation modal");
      setShowConfirmModal(true);
    } else {
      console.log("Validation failed, modal will not show");
    }
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitError(null);
      setShowConfirmModal(false); // Close confirmation modal
      setIsSubmitModalOpen(true); // Show loading modal
      // Clean and validate the data before submission
      const cleanedData = {
        ...formData,
        no_of_fishers: Number(formData.no_of_fishers),
        built_year: Number(formData.built_year),
        registered_length: Number(formData.registered_length),
        registered_breadth: Number(formData.registered_breadth),
        registered_depth: Number(formData.registered_depth),
        tonnage_length: Number(formData.tonnage_length),
        tonnage_breadth: Number(formData.tonnage_breadth),
        tonnage_depth: Number(formData.tonnage_depth),
        gross_tonnage: Number(formData.gross_tonnage),
        net_tonnage: Number(formData.net_tonnage),
        is_active: formData.is_active === true || formData.is_active === "true",
      };
      
      // Explicitly remove boat_image from cleaned data to prevent validation errors
      delete cleanedData.boat_image;

      console.log("Submitting cleaned data:", cleanedData);
      // 1. Update Boat - Use JSON instead of FormData to avoid file upload issues
      console.log("DEBUG: Sending boat update with data:", {
        mfbr_number: cleanedData.boat_id, // boat_id is actually mfbr_number (used for URL only)
        boat_name: cleanedData.boat_name,
        boat_type: cleanedData.boat_type,
        isEditing: isEditing
      });
      
      // Create JSON data object instead of FormData
      const boatUpdateData = {
        boat_name: (cleanedData.boat_name || "Unnamed").trim(),
        boat_type: cleanedData.boat_type || "Motorized",
        built_place: (cleanedData.built_place || "Unknown").trim(),
        built_year: Math.max(1900, Math.min(new Date().getFullYear(), cleanedData.built_year || 2000)),
        material_used: cleanedData.material_used || "Wood",
        homeport: (cleanedData.homeport || "Unknown").trim(),
        
        // Required fields - ensure all have valid non-empty values
        application_date: new Date().toISOString().split('T')[0],
        type_of_registration: "New/Initial Registration",
        fishing_ground: "Unknown",
        fma_number: "Unknown",
        engine_make: "Unknown",
        serial_number: "Unknown",
        horsepower: "0",
        type_of_ownership: cleanedData.ownership_type || "Individual",
        no_fishers: Math.max(1, cleanedData.no_of_fishers || 1),
        is_active: cleanedData.is_active,
        registered_municipality: (cleanedData.municipality || "Unknown").trim()
        
        // Note: Deliberately NOT including boat_image or fisherfolk_registration_number
        // boat_image - not needed for basic updates, causes validation error
        // fisherfolk_registration_number - shouldn't change during updates
      };
      
      console.log("About to update boat with ID:", cleanedData.boat_id);
      console.log("JSON data being sent:", boatUpdateData);
      
      await updateBoat(cleanedData.boat_id, boatUpdateData);
      console.log("Boat updated successfully");
      
      // Continue with measurements and fisherfolk boat updates

      // 2. Update or create Boat Measurements
      try {
        const measurementsData = {
          registered_length: cleanedData.registered_length,
          registered_breadth: cleanedData.registered_breadth,
          registered_depth: cleanedData.registered_depth,
          tonnage_length: cleanedData.tonnage_length,
          tonnage_breadth: cleanedData.tonnage_breadth,
          tonnage_depth: cleanedData.tonnage_depth,
          gross_tonnage: cleanedData.gross_tonnage,
          net_tonnage: cleanedData.net_tonnage,
        };
        
        if (isEditing) {
          // Try to update existing measurements first
          try {
            await updateBoatMeasurements(cleanedData.boat_id, measurementsData);
            console.log("Boat measurements updated successfully");
          } catch {
            // If update fails, try to create new measurements
            measurementsData.boat = cleanedData.boat_id;
            await createBoatMeasurements(measurementsData);
            console.log("Boat measurements created successfully");
          }
        } else {
          // For new boats, create measurements
          measurementsData.boat = cleanedData.boat_id;
          await createBoatMeasurements(measurementsData);
          console.log("Boat measurements created successfully");
        }
      } catch (measurementError) {
        console.log("Measurement operation failed:", measurementError);
        // Continue with the process even if measurements fail
      }

      // 3. Update FisherfolkBoat registration
      const fisherfolkBoatFormData = new FormData();
      fisherfolkBoatFormData.append(
        "registration_number",
        cleanedData.fisherfolk_number
      );
      fisherfolkBoatFormData.append("mfbr_number", cleanedData.boat_id);
      fisherfolkBoatFormData.append(
        "type_of_ownership",
        cleanedData.ownership_type || "Individual"
      );
      fisherfolkBoatFormData.append(
        "no_of_fishers",
        cleanedData.no_of_fishers || "1"
      );
      fisherfolkBoatFormData.append(
        "homeport",
        cleanedData.homeport || "Unknown"
      );
      fisherfolkBoatFormData.append("is_active", cleanedData.is_active);

      await updateFisherfolkBoat(
        cleanedData.boat_registry_no,
        fisherfolkBoatFormData
      );


      setIsSubmitModalOpen(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Full error object:", error);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);
      console.error("Error response status:", error.response?.status);
      
      let errorMessage = "An error occurred while updating the boat";
      
      if (error.response?.status === 500) {
        errorMessage = "Server error (500). Please check the backend logs for details. Error: " + 
          (error.response?.data?.message || error.response?.data || "Internal server error");
      } else if (error.response?.data) {
        if (typeof error.response.data === "string") {
          errorMessage = error.response.data;
        } else if (typeof error.response.data === "object") {
          errorMessage = Object.entries(error.response.data)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
            .join("\n");
        }
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setSubmitError(errorMessage);
      setIsSubmitModalOpen(false);
      // Don't navigate away so user can see the error
    }
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    setIsCancelModalOpen(false);
    navigate("/admin/boatRegistryManagement");
  };

  const inputClasses =
    "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500";
  const labelClasses = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="container mx-auto px-4 pt-8 pb-15">
      <form onSubmit={handleSubmit} className="space-y-8">
        {submitError && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {submitError}
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            Registration Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>Boat Registry No.</label>
              <input
                type="text"
                name="boat_registry_no"
                value={formData.boat_registry_no}
                onChange={handleChange}
                className={inputClasses}
                required
                disabled={isEditing}
              />
            </div>
            <div>
              <label className={labelClasses}>Maximun Capacity</label>
              <input
                type="text"
                name="fisherfolk_number"
                value={formData.fisherfolk_number}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Homeport</label>
              <input
                type="text"
                name="homeport"
                value={formData.homeport}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>No. of Fishers</label>
              <input
                type="number"
                name="no_of_fishers"
                value={formData.no_of_fishers}
                onChange={handleChange}
                className={inputClasses}
                required
                min="1"
              />
            </div>

            <div>
              <label className={labelClasses}>Status</label>
              <select
                name="is_active"
                value={String(formData.is_active)}
                onChange={handleChange}
                className={inputClasses}
                required
              >
                <option value="">Select Status</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Ownership Type</label>
              <select
                name="ownership_type"
                value={formData.ownership_type}
                onChange={handleChange}
                className={inputClasses}
                required
              >
                <option value="">Select Ownership</option>
                {ownershipOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            Boat Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>Boat Name</label>
              <input
                type="text"
                name="boat_name"
                value={formData.boat_name}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Boat Type</label>
              <select
                name="boat_type"
                value={formData.boat_type}
                onChange={handleChange}
                className={inputClasses}
                required
              >
                <option value="">Select Type</option>
                {boatTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Material Used</label>
              <input
                type="text"
                name="material_used"
                value={formData.material_used}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Built Place</label>
              <input
                type="text"
                name="built_place"
                value={formData.built_place}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Built Year</label>
              <input
                type="number"
                name="built_year"
                value={formData.built_year}
                onChange={handleChange}
                className={inputClasses}
                required
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>

            <div>
              <label className={labelClasses}>Barangay</label>
              <input
                type="text"
                name="barangay"
                value={formData.barangay}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Municipality</label>
              <input
                type="text"
                name="municipality"
                value={formData.municipality}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            Boat Dimensions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>Registered Length (m)</label>
              <input
                type="number"
                name="registered_length"
                value={formData.registered_length}
                onChange={handleChange}
                className={inputClasses}
                required
                min="20"
                max="25"
                step="1"
              />
            </div>
            <div>
              <label className={labelClasses}>Registered Breadth (m)</label>
              <input
                type="number"
                name="registered_breadth"
                value={formData.registered_breadth}
                onChange={handleChange}
                className={inputClasses}
                required
                min="0.75"
                max="0.8"
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClasses}>Registered Depth (m)</label>
              <input
                type="number"
                name="registered_depth"
                value={formData.registered_depth}
                onChange={handleChange}
                className={inputClasses}
                required
                min="0.75"
                max="0.8"
                step="0.01"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={handleCancelClick}
            className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {isEditing ? "Update Boat" : "Register Boat"}
          </button>
        </div>
      </form>
      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        title={isEditing ? "Update Boat" : "Register Boat"}
        message={
          isEditing
            ? "Are you sure you want to save these changes?"
            : "Are you sure you want to register this boat?"
        }
        confirmText={isEditing ? "Update" : "Register"}
        cancelText="Cancel"
      />
      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Changes"
        message="Are you sure you want to cancel? Any unsaved changes will be lost."
        confirmText="Yes, Cancel"
        cancelText="No, Keep Editing"
      />
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        message={
          isEditing
            ? "Boat information has been successfully updated!"
            : "Boat has been successfully registered!"
        }
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/boatRegistryManagement");
        }}
      />
      
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title={isEditing ? "Confirm Update" : "Confirm Registration"}
        message={
          isEditing
            ? "Are you sure you want to save these changes to the boat information?"
            : "Are you sure you want to register this boat?"
        }
      />
    </div>
  );
};

BoatForm.propTypes = {
  initialData: PropTypes.object,
  isEditing: PropTypes.bool,
};

BoatForm.defaultProps = {
  initialData: null,
  isEditing: false,
};

export default BoatForm;
