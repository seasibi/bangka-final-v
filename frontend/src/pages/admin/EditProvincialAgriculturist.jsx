import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PageTitle from "../../components/PageTitle";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import SuccessModal from "../../components/SuccessModal";
import { getCookie } from "../../utils/cookieUtils";
import provincialAgriculturistService from "../../services/provincialAgriculturistService";
import { useAuth } from "../../contexts/AuthContext";

const EditProvincialAgriculturist = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    position: "",
    contact_number: "",
    user_role: "provincial_agriculturist",
    sex: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchAgriculturistData();
  }, [id]);

  const fetchAgriculturistData = async () => {
    try {
      const token = getCookie("access_token");
      if (!token) {
        setError("No access token found. Please log in again.");
        return;
      }

      const response = await provincialAgriculturistService.get(id);
      console.log(response.data);
      let fetched = response.data;
      // Remove +63 if present for display
      if (fetched.contact_number && fetched.contact_number.startsWith("+63")) {
        fetched.contact_number = fetched.contact_number.slice(3);
      }
      if (!fetched.user_role) {
        fetched.user_role = "provincial_agriculturist";
      }

      setFormData(fetched);
      console.log(fetched);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching agriculturist data:", error);
      setError("Failed to fetch agriculturist data. Please try again.");
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsReviewModalOpen(true);
  };

  const handleReviewConfirm = async () => {
    setIsReviewModalOpen(false);
    try {
      const token = getCookie("access_token");
      if (!token) {
        setError("No access token found. Please log in again.");
        return;
      }
      const payload = {
        ...formData,
        contact_number: `+63${formData.contact_number}`,
      };
      await provincialAgriculturistService.update(id, payload);


      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error updating agriculturist:", error);
      setError("Failed to update agriculturist. Please try again.");
    }
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    setIsCancelModalOpen(false);
    navigate("/admin/provincialAgriManagement");
  };

  const positionOptions = {
    municipal_agriculturist: [
      { value: "senior aquaculturist", label: "Senior Aquaculturist" },
      { value: "aquaculturist II", label: "Aquaculturist II" },
      {
        value: "aquacultural technician I",
        label: "Aquacultural Technician I",
      },
    ],
    provincial_agriculturist: [
      { value: "senior aquaculturist", label: "Senior Aquaculturist" },
      { value: "aquaculturist II", label: "Aquaculturist II" },
      {
        value: "aquacultural technician I",
        label: "Aquacultural Technician I",
      },
      {
        value: "senior fishing regulations officer",
        label: "Senior Fishing Regulations Officer",
      },
      {
        value: "fishing regulations officer I",
        label: "Fishing Regulations Officer I",
      },
    ],
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button
          type="button"
          onClick={() => navigate("/admin/provincialAgriManagement")}
          variant="icon"
        >
          {/* Back icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </Button>
        <h1 className="text-2xl font-semibold text-gray-800 ml-3">
          Edit Provincial Agriculturist
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-md p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Middle Name
            </label>
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Number
            </label>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +63
              </span>
              <input
                type="text"
                name="contact_number"
                value={formData.contact_number}
                onChange={(e) => {
                  // Only allow digits, max 10, must start with 9
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length === 0 || val[0] === "9") {
                    setFormData((prev) => ({
                      ...prev,
                      contact_number: val.slice(0, 10),
                    }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="9XXXXXXXXX"
                maxLength="10"
                minLength="10"
                pattern="9[0-9]{9}"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter 10 digits starting with 9 (e.g., 9123456789)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sex
            </label>
            <div className="flex items-center space-x-4 mt-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="sex"
                  value="male"
                  checked={formData.sex === "male"}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Male</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="sex"
                  value="female"
                  checked={formData.sex === "female"}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Female</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <select
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select Position</option>
              {positionOptions[formData.user_role] &&
                positionOptions[formData.user_role].map((pos, idx) => (
                  <option key={idx} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            onClick={handleCancelClick}
            type="button"
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Update Agriculturist
          </Button>
        </div>
      </form>

      {/* Review Data Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onConfirm={handleReviewConfirm}
        title="Review Update"
        message={
          <div>
            <div>
              Are you sure you want to update this agriculturist's information?
            </div>
            <div>
              <strong>First Name:</strong> {formData.first_name}
            </div>
            <div>
              <strong>Middle Name:</strong> {formData.middle_name}
            </div>
            <div>
              <strong>Last Name:</strong> {formData.last_name}
            </div>
            <div>
              <strong>Position:</strong> {formData.position}
            </div>
            <div>
              <strong>Contact Number:</strong> +63{formData.contact_number}
            </div>
          </div>
        }
        confirmText="Confirm Update"
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
        message="Provincial Agriculturist has been successfully updated!"
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/provincialAgriManagement");
        }}
      />
    </div>
  );
};

export default EditProvincialAgriculturist;
