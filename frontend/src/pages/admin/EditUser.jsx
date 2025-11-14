import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PageTitle from "../../components/PageTitle";
import Button from "../../components/Button";
import SuccessModal from "../../components/SuccessModal";
import { getCookie } from "../../utils/cookieUtils";
import { logActivity } from "../../utils/activityLog";
import { useAuth } from "../../contexts/AuthContext";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";

// Add your municipality list here. Replace with your actual list if needed.
const municipalities = [
  "Agoo", "Aringay", "Bacnotan", "Bagulin", "Balaoan", "Bangar",
  "Bauang", "Burgos", "Caba", "Luna", "Naguilian", "Pugo", "Rosario",
  "San Fernando", "San Gabriel", "San Juan", "Santo Tomas", "Santol",
  "Sudipen", "Tubao",
];

const EditUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    email: "",
    user_role: "provincial_agriculturist",
    status: "Active",
    first_name: "",
    middle_name: "",
    last_name: "",
    sex: "male",
    contact_number: "",
    position: "",
    municipality: "",
    is_active: true,
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { user } = useAuth();

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    try {
      const token = getCookie("access_token");
      const response = await axios.get(
        `http://localhost:8000/api/users/update/${id}/`,
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const userData = response.data;
      let merged = {
        email: userData.email || "",
        user_role: userData.user_role || "",
        is_active: userData.is_active ?? true,
        status: userData.is_active ? "Active" : "Inactive",
        first_name: "",
        middle_name: "",
        last_name: "",
        sex: "",
        contact_number: "",
        position: "",
        municipality: "",
        username: userData.username || "",
      };

      if (
        userData.user_role === "provincial_agriculturist" &&
        userData.provincial_agriculturist
      ) {
        merged = { ...merged, ...userData.provincial_agriculturist };
      } else if (
        userData.user_role === "municipal_agriculturist" &&
        userData.municipal_agriculturist
      ) {
        merged = { ...merged, ...userData.municipal_agriculturist };
      }

      if (merged.contact_number?.startsWith("+63")) {
        merged.contact_number = merged.contact_number.slice(3);
      }

      Object.keys(merged).forEach((key) => {
        if (merged[key] === null || merged[key] === undefined) merged[key] = "";
      });

      setFormData(merged);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Failed to fetch user data.");
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    // Validate required fields before proceeding to confirmation step
    if (formData.user_role === "municipal_agriculturist" && !formData.municipality) {
      setError("Municipality is required for Municipal Agriculturists.");
      return;
    }
    setError(null);
    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleConfirmSubmit = async () => {
    try {
      // Client-side validation for role-specific fields
      if (formData.user_role === "municipal_agriculturist" && !formData.municipality) {
        setError("Municipality is required for Municipal Agriculturists.");
        return;
      }

      const contact_number_db = formData.contact_number.startsWith("+63")
        ? formData.contact_number
        : `+63${formData.contact_number}`;

      // Build minimal payload accepted by backend serializer
      let updateData = {
        email: formData.email,
        user_role: formData.user_role, // ensure backend switches role
        is_active: formData.is_active,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        sex: formData.sex,
        contact_number: contact_number_db,
        position: formData.position,
        municipality: formData.municipality,
      };

      if (formData.user_role === "municipal_agriculturist") {
        updateData.municipal_agriculturist = {
          first_name: updateData.first_name,
          middle_name: updateData.middle_name,
          last_name: updateData.last_name,
          sex: updateData.sex,
          contact_number: updateData.contact_number,
          position: updateData.position,
          municipality: updateData.municipality,
        };
      } else if (formData.user_role === "provincial_agriculturist") {
        updateData.provincial_agriculturist = {
          first_name: updateData.first_name,
          middle_name: updateData.middle_name,
          last_name: updateData.last_name,
          sex: updateData.sex,
          contact_number: updateData.contact_number,
          position: updateData.position,
        };
      }

      const token = getCookie("access_token");
      await axios.put(
        `http://localhost:8000/api/users/update/${id}/`,
        updateData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );


      setShowSuccessModal(true);
      setError(null);
    } catch (error) {
      console.error("Error updating user:", error);
      // Try to surface backend validation messages
      const msg = error?.response?.data?.details || error?.response?.data?.error || "Failed to update user.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  const InfoField = ({ label, value }) => (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-base font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div
      className="container mx-auto px-4 py-8 font-montserrat"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      {/* Title and Back Button */}
      <div className="flex items-center mb-3 mt-2">
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
        <div className="grid grid-cols-1 grid-rows-2 ml-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentStep === 1 ? "Edit User Profile" : "Confirm User Details"}
          </h1>
          <p className="text-base text-gray-700">
            {currentStep === 1
              ? "Edit user account personal details."
              : "Review the details before updating this user."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      {currentStep === 1 && (
        <form onSubmit={handleNext} className="bg-white p-6 rounded-lg shadow">
          {/* Account Details Section */}
          <h4
            className="text-xl font-medium mb-3 bg-blue-100 rounded px-3 py-2 border-b-2"
            style={{ color: "#3863CF", borderBottomColor: "#3863CF" }}
          >
            Account Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                name="user_role"
                value={formData.user_role}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="provincial_agriculturist">
                  Provincial Agriculturist
                </option>
                <option value="municipal_agriculturist">
                  Municipal Agriculturist
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-6 mt-2">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="Active"
                    checked={formData.status === "Active"}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        status: "Active",
                        is_active: true,
                      }));
                    }}
                    className="form-radio text-blue-600 focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2 text-gray-700">Active</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="Inactive"
                    checked={formData.status === "Inactive"}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        status: "Inactive",
                        is_active: false,
                      }));
                    }}
                    className="form-radio text-blue-600 focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2 text-gray-700">Inactive</span>
                </label>
              </div>
            </div>
          </div>
          {/* Personal Information Section */}
          <div className="mb-6 mt-4">
            <h4
              className="text-xl font-medium mb-3 bg-blue-100 rounded px-3 py-2 border-b-2"
              style={{ color: "#3863CF", borderBottomColor: "#3863CF" }}
            >
              Personal Information
            </h4>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
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
                <label className="block text-sm font-medium text-gray-700">
                  Middle Name
                </label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
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
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sex
                </label>
                <div className="flex gap-4 mt-3 ml-7">
                  <label className="flex items-center mr-15">
                    <input
                      type="radio"
                      name="sex"
                      value="male"
                      checked={formData.sex === "male"}
                      onChange={handleInputChange}
                      required
                      className="mr-2"
                    />
                    Male
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sex"
                      value="female"
                      checked={formData.sex === "female"}
                      onChange={handleInputChange}
                      required
                      className="mr-2"
                    />
                    Female
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
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
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="9XXXXXXXXX"
                    maxLength="10"
                    minLength="10"
                    pattern="9[0-9]{9}"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              {formData.user_role === "municipal_agriculturist" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Municipality <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <Listbox
                      value={formData.municipality}
                      onChange={(value) =>
                        handleInputChange({
                          target: { name: "municipality", value },
                        })
                      }
                    >
                      <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <span className="block truncate">
                          {formData.municipality || "Select Municipality"}
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                          />
                        </span>
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 bottom-full mb-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {municipalities.map((mun) => (
                          <Listbox.Option
                            key={mun}
                            className={({ active }) =>
                              `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-900" : "text-gray-900"}`
                            }
                            value={mun}
                          >
                            {({ selected }) => (
                              <>
                                <span
                                  className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                                >
                                  {mun}
                                </span>
                                {selected ? (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                    ✓
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Listbox>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md"
            >
              Next
            </Button>
          </div>
        </form>
      )}

      {currentStep === 2 && (
        <div
          className="space-y-6 relative font-montserrat"
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            {/* Account Information */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
              Account Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoField label="Email" value={formData.email} />
              <InfoField
                label="Role"
                value={formData.user_role
                  .replace("_", " ")
                  .split(" ")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
              />
              <InfoField
                label="Status"
                value={
                  formData.status.charAt(0).toUpperCase() +
                  formData.status.slice(1)
                }
              />
            </div>

            {/* Personal Information */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoField label="First Name" value={formData.first_name} />
              <InfoField
                label="Middle Name"
                value={formData.middle_name || "—"}
              />
              <InfoField label="Last Name" value={formData.last_name} />
              <InfoField
                label="Sex"
                value={formData.sex === "male" ? "Male" : "Female"}
              />
              <InfoField
                label="Contact Number"
                value={`+63${formData.contact_number}`}
              />
              <InfoField label="Position" value={formData.position} />
              {formData.user_role === "municipal_agriculturist" && (
                <InfoField label="Municipality" value={formData.municipality} />
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <Button onClick={handleBack} variant="secondary">
                Back
              </Button>
              <Button onClick={handleConfirmSubmit} variant="primary">
                Update User
              </Button>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={showSuccessModal}
        title="Successfully Updated"
        message={
          <span>
            <span className="font-bold">
              {formData.first_name} {formData.last_name}
            </span>{" "}
            has been successfully updated!
          </span>
        }
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/userManagement");
        }}
      />
    </div>
  );
};

export default EditUser;
