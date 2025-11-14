import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import SuccessModal from "../../components/SuccessModal";
import axios from "axios";
import { API_URLS } from "../../services/api_urls";
import AddUserForm from "../../components/UserManagement/AddUserForm";

const AddUser = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // 👇 dynamic title & subtitle
  const [formTitle, setFormTitle] = useState("Add New User");
  const [formSubtitle, setFormSubtitle] = useState(
    "Please fill out the form and confirm details to register a new user."
  );

  const handleSubmit = async (formData) => {
    try {
      setError(null);

      const contact_number = formData.contact_number;
      if (!contact_number) {
        setError("Phone number is required");
        return;
      }

      if (contact_number.length !== 10) {
        setError("Phone number must be exactly 10 digits after +63 or 09");
        return;
      }

      if (!contact_number.startsWith("9")) {
        setError("Phone number must start with 9");
        return;
      }

      // Format phone number to include +63 prefix
      const formattedData = {
        ...formData,
        contact_number: `+63${contact_number}`,
      };

      const response = await axios.post(
        `${API_URLS}users/create/`,
        formattedData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data) {
        const userEmail = formData.email;


        setSuccessMessage(
          `User ${userEmail} is successfully added as ${formData.user_role
            .replace(/_/g, " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")}`
        );
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Error creating user:", error);
      if (error.response) {
        if (error.response.status === 400) {
          if (error.response.data.details) {
            const errorMessages = [];
            Object.entries(error.response.data.details).forEach(
              ([field, errors]) => {
                const fieldName = field
                  .split("_")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ");

                errors.forEach((err) => {
                  errorMessages.push(`${fieldName}: ${err}`);
                });
              }
            );
            setError(errorMessages.join("\n"));
          } else {
            setError(
              error.response.data.error ||
                "Invalid form data. Please check your inputs."
            );
          }
        } else if (error.response.status === 401) {
          setError("Session expired. Please log in again.");
        } else {
          setError("Failed to create user. Please try again.");
        }
      } else {
        setError("Network error. Please check your connection.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="h-full bg-gray-50 px-4 py-6 pb-16">
        {/* form title */}
        <div className="flex items-center mb-3 mt-2">
          {/* back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>

          {/* dynamic title & subtitle */}
          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1
              className="text-3xl font-bold text-gray-900"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {formTitle}
            </h1>
            <p
              className="text-base text-gray-700"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {formSubtitle}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 text-sm bg-red-100 rounded-lg border border-red-200">
            {error.split("\n").map((err, index) => (
              <div key={index} className="text-red-700">
                {err}
              </div>
            ))}
          </div>
        )}

        {/* pass title setters to child */}
        <AddUserForm
          onSubmit={handleSubmit}
          setFormTitle={setFormTitle}
          setFormSubtitle={setFormSubtitle}
        />
      </div>

      <SuccessModal
        isOpen={showSuccessModal}
        title="Successfully Added"
        message={successMessage}
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/users");
        }}
      />
    </div>
  );
};

export default AddUser;
