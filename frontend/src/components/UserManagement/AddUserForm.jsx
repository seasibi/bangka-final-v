import React, { useState, useEffect, useRef } from "react";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/solid";
import Button from "../Button";
import Loader from "../Loader";
import ConfirmModal from "../ConfirmModal";


const AddUserForm = ({ onSubmit, setFormTitle, setFormSubtitle, error }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAdminLogoutModal, setShowAdminLogoutModal] = useState(false);
  const emailCheckTimeout = useRef(null);

  const [municipalityOptions, setMunicipalityOptions] = useState([]);
  const [municipalityLoadError, setMunicipalityLoadError] = useState("");
  const [municipalityLoading, setMunicipalityLoading] = useState(false);

  const [formData, setFormData] = useState(() => {
    // Load from localStorage if available
    const savedData = localStorage.getItem('addUserFormData');
    if (savedData) {
      try {
        return JSON.parse(savedData);
      } catch (e) {
        console.error('Error parsing saved form data:', e);
      }
    }
    return {
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
    };
  });

  const positionOptions = {
    admin: [
      { value: "System Administrator", label: "System Administrator" },
      { value: "IT Administrator", label: "IT Administrator" },
      { value: "Database Administrator", label: "Database Administrator" },
    ],
    municipal_agriculturist: [
      { value: "Senior Aquaculturist", label: "Senior Aquaculturist" },
      { value: "Aquaculturist II", label: "Aquaculturist II" },
      { value: "Aquacultural Technician I", label: "Aquacultural Technician I" },
    ],
    provincial_agriculturist: [
      { value: "Agricultural Center Chief II", label: "Agricultural Center Chief II" },
      { value: "Senior Aquaculturist", label: "Senior Aquaculturist" },
      { value: "Aquaculturist II", label: "Aquaculturist II" },
      { value: "Aquacultural Technician I", label: "Aquacultural Technician I" },
      { value: "Senior Fishing Regulations Officer", label: "Senior Fishing Regulations Officer" },
      { value: "Fishing Regulations Officer I", label: "Fishing Regulations Officer I" },
    ]
  };

  // Save formData to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('addUserFormData', JSON.stringify(formData));
  }, [formData]);

  // update parent title/subtitle based on step
  useEffect(() => {
    if (currentStep === 1) {
      setFormTitle("Add New User");
      setFormSubtitle("Please fill out the form and confirm details to register a new user.");
    } else if (currentStep === 2) {
      setFormTitle("Confirm New User Details");
      setFormSubtitle("Review the information before submitting.");
    }
  }, [currentStep, setFormTitle, setFormSubtitle]);

  // Load municipalities from backend (requires authentication)
  useEffect(() => {
    const loadMunicipalities = async () => {
      setMunicipalityLoading(true);
      setMunicipalityLoadError("");
      try {
        const res = await fetch('/api/municipalities/', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load municipalities');
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        const names = list.map((m) => m?.name).filter(Boolean);
        setMunicipalityOptions(names);
      } catch (e) {
        setMunicipalityLoadError('Failed to load municipalities');
        setMunicipalityOptions([]);
      } finally {
        setMunicipalityLoading(false);
      }
    };
    loadMunicipalities();
  }, []);

  // Clear localStorage after successful submission
  const clearFormData = () => {
    localStorage.removeItem('addUserFormData');
  };

  // Update handleConfirmSubmit to clear localStorage after successful submission
  const handleConfirmSubmitWithClear = async () => {
    try {
      await handleConfirmSubmit();
      clearFormData();
    } catch (err) {
      console.error('Error during form submission:', err);
    }
  };

  // helper: convert to title case
  const toTitleCase = (str) =>
    str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      let newValue = value;
      if (["first_name", "middle_name", "last_name", "municipality"].includes(name)) {
        newValue = toTitleCase(value);
      }
      if (["status"].includes(name)) {
        newValue = value.toUpperCase();
      }
      const newFormData = { ...prev, [name]: newValue };
      if (name === "user_role") {
        // Auto-set position for admin role
        if (value === "admin") {
          newFormData.position = "System Administrator";
        } else {
          newFormData.position = "";
        }
        if (value !== "municipal_agriculturist") newFormData.municipality = "";
      }
      return newFormData;
    });

    // contact_number UI removed — keep formData entry but do not perform inline validation here
  };

  // Debounced email validation + backend check
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, email: value }));
    setEmailError("");
    setEmailStatus("");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      setEmailError("Email is required.");
      return;
    } else if (!emailPattern.test(value)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    // Debounce backend check
    if (emailCheckTimeout.current) clearTimeout(emailCheckTimeout.current);
    emailCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/check-email?email=${value}`);
        const data = await response.json();

        if (data.available) {
          setEmailStatus("Email address is valid and available.");
          setEmailError("");
        } else {
          setEmailError("This email is already registered.");
          setEmailStatus("");
        }
      } catch (err) {
        console.error("Error checking email:", err);
      }
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let hasError = false;
  setEmailError("");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailPattern.test(formData.email)) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    }
    if (hasError) return;

    // Check backend before proceeding
    try {
      const response = await fetch(`/api/users/check-email?email=${formData.email}`);
      const data = await response.json();
      if (!data.available) {
        setEmailError("Email already exists");
        return;
      }
    } catch (err) {
      console.error(err);
    }

    if (currentStep === 1) setCurrentStep(2);
    else {
      // Show confirmation modal on step 2
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    try {
      // Ensure backend-required phone number exists. If the UI removed it, provide a safe default
      // that matches the expected format (10 digits starting with 9).
      const payload = { ...formData };
      if (!payload.contact_number) payload.contact_number = "9000000000";
      await onSubmit(payload);

      // If a new admin was created, show modal and logout this session
      if ((formData.user_role || '').toLowerCase() === 'admin') {
        setShowAdminLogoutModal(true);
        try {
          // Clear saved draft
          localStorage.removeItem('addUserFormData');
          // Call backend logout to clear cookies
          await fetch('/api/logout/', {
            method: 'POST',
            credentials: 'include',
          });
        } catch (e) {
          // ignore network errors, still redirect
        } finally {
          // Redirect to login after short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      }
    } finally { setLoading(false); }
  };

  const handleBack = () => setCurrentStep(1);

  const renderStep1 = () => (
    <div className="space-y-6 relative font-montserrat" style={{ fontFamily: "Montserrat, sans-serif" }}>
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
          Account Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleEmailChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="user@example.com"
              required
            />
            {emailError && <p className="text-sm text-red-600 mt-1">{emailError}</p>}
            {emailStatus && <p className="text-sm text-green-600 mt-1">{emailStatus}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              name="user_role"
              value={formData.user_role}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="admin">Admin</option>
              <option value="provincial_agriculturist">Provincial Agriculturist</option>
              <option value="municipal_agriculturist">Municipal Agriculturist</option>
            </select>
          </div>
        </div>

        {/* Personal Information Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Profile Information
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sex <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-6 mt-2">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="sex"
                    value="male"
                    checked={formData.sex === "male"}
                    onChange={handleInputChange}
                    className="form-radio text-blue-600 focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2 text-gray-700">Male</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="sex"
                    value="female"
                    checked={formData.sex === "female"}
                    onChange={handleInputChange}
                    className="form-radio text-blue-600 focus:ring-blue-500"
                    required
                  />
                  <span className="ml-2 text-gray-700">Female</span>
                </label>
              </div>
            </div>

            {formData.user_role !== "admin" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Position <span className="text-red-500">*</span>
                </label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Position</option>
                  {positionOptions[formData.user_role].map((pos, index) => (
                    <option key={index} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                      {formData.municipality || (municipalityLoading ? "Loading municipalities..." : "Select Municipality")}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </span>
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-10 bottom-full mb-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {municipalityLoading ? (
                      <div className="py-2 px-3 text-gray-500">Loading...</div>
                    ) : municipalityLoadError ? (
                      <div className="py-2 px-3 text-red-600">{municipalityLoadError}</div>
                    ) : municipalityOptions.length === 0 ? (
                      <div className="py-2 px-3 text-gray-500">No municipalities found</div>
                    ) : (
                      municipalityOptions.map((mun) => (
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
                      ))
                    )}
                  </Listbox.Options>
                </Listbox>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> A temporary password will be automatically
            generated and sent to the user's email address.
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
          type="submit"
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Next
        </Button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
  <div
    className="space-y-6 relative font-montserrat"
    style={{ fontFamily: "Montserrat, sans-serif" }}
  >
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      {/* Account Information */}
      <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
        Account Information
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoField label="Email" value={formData.email} />
        <InfoField
          label="Role"
          value={formData.user_role
            .replace("_", " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")}
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
        <InfoField label="Position" value={formData.position} />
        {formData.user_role === "municipal_agriculturist" && (
          <InfoField label="Municipality" value={formData.municipality} />
        )}
      </div>

      {/* Note Section */}
      <div className="mt-6 p-4 bg-green-50 rounded-md">
        <p className="text-sm text-green-800">
          <strong>Note:</strong> Upon confirmation, a temporary password will be
          generated and sent to{" "}
          <span className="font-semibold text-green-900">{formData.email}</span>
          .
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex justify-between">
        <Button type="button" onClick={handleBack} variant="secondary">
          Back
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Creating..." : "Create User"}
        </Button>
      </div>
    </div>
  </div>
);

// InfoField styled like Step 1 labels
const InfoField = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-gray-700">{label}</p>
    <p className="text-base font-semibold text-gray-900 mt-1">{value}</p>
  </div>
);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {loading && (
        <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center z-50">
          <Loader className="h-16 w-16 text-white" />
        </div>
      )}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmitWithClear}
        title="Confirm User Creation"
        message="Are you sure you want to create this user?"
      />

      {showAdminLogoutModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Created</h3>
            <p className="text-sm text-gray-600 mb-4">A new admin has been successfully created. You are now being logged out…</p>
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default AddUserForm;
