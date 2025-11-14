import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import SuccessModal from "../../components/SuccessModal";
import { apiClient } from "../../services/api_urls";
import { useAuth } from "../../contexts/AuthContext";
import { AnimatePresence } from "framer-motion";

// Reusable Section component
const Section = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
      {title}
    </h3>
    {children}
  </div>
);

// Fallback display
const displayValue = (val) => {
  if (val === null || val === undefined || val === "") return "Not provided";
  return val;
};

// Label-value info
const Info = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-blue-800">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-1">
      {displayValue(value)}
    </p>
  </div>
);

const AdminUserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); // get id from URL if available
  const { user } = useAuth();

  const [userData, setUserData] = useState(location.state?.userData || null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch user if not passed via location.state
  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!userData && id) {
          const response = await apiClient.get(`/users/${id}/`);
          setUserData(response.data);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, [id, userData]);

  // Log whenever userData changes
  useEffect(() => {
    if (userData) {
      console.log("Fetched User Data:", userData);
    }
  }, [userData]);

  if (!userData) {
    return <div className="p-6">No user data found.</div>;
  }

  const handleUpdateStatus = async () => {
    try {
      await apiClient.put(`/users/update/${userData.id}/`, {
        is_active: !userData.is_active,
      });

      const wasActive = userData.is_active;

      // Track last deactivation locally for sorting in list
      try {
        const map = JSON.parse(localStorage.getItem('users_last_deactivated') || '{}');
        if (wasActive) {
          map[userData.id] = Date.now();
        } else {
          delete map[userData.id];
        }
        localStorage.setItem('users_last_deactivated', JSON.stringify(map));
      } catch {}

      setIsStatusModalOpen(false);
      setSuccessMsg(
        `${wasActive ? "User deactivated" : "User activated"} successfully.`
      );
      setSuccessOpen(true);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleEdit = () => {
    setIsEditModalOpen(false);
    navigate(`/admin/users/edit/${userData.id}`, {
      state: { userData },
    });
  };

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
            View User Profile
          </h1>
          <p className="text-base text-gray-700">
            View and manage user account details.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {userData?.municipal_agriculturist?.first_name ||
                  userData?.provincial_agriculturist?.first_name}{" "}
                {userData?.municipal_agriculturist?.last_name ||
                  userData?.provincial_agriculturist?.last_name}
              </h2>
              <p className="text-sm text-gray-500">{userData.email}</p>
              <span
                className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${
                  userData.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {userData.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button onClick={() => setIsEditModalOpen(true)}>Edit</Button>
            <Button
              onClick={() => setIsStatusModalOpen(true)}
              className={`${
                userData.is_active
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              } text-white px-4 py-2 rounded-md`}
              disabled={userData.user_role === "admin"}
            >
              {userData.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </div>

        {/* Account Information */}
        <Section title="Account Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Info label="Email" value={userData.email} />
            <Info
              label="Role"
              value={
                userData.user_role === "provincial_agriculturist"
                  ? "Provincial Agriculturist"
                  : userData.user_role === "municipal_agriculturist"
                    ? "Municipal Agriculturist"
                    : "Admin"
              }
            />
            <Info
              label="Status"
              value={userData.is_active ? "Active" : "Inactive"}
            />
          </div>
        </Section>

        {/* Profile Information */}
        <Section title="Profile Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Info
              label="First Name"
              value={
                userData?.municipal_agriculturist?.first_name ||
                userData?.provincial_agriculturist?.first_name
              }
            />
            <Info
              label="Middle Name"
              value={
                userData?.municipal_agriculturist?.middle_name ||
                userData?.provincial_agriculturist?.middle_name
              }
            />
            <Info
              label="Last Name"
              value={
                userData?.municipal_agriculturist?.last_name ||
                userData?.provincial_agriculturist?.last_name
              }
            />
            <Info
              label="Sex"
              value={
                userData?.municipal_agriculturist
                  ? userData.municipal_agriculturist.sex === "male"
                    ? "Male"
                    : "Female"
                  : userData?.provincial_agriculturist
                    ? userData.provincial_agriculturist.sex === "male"
                      ? "Male"
                      : "Female"
                    : "Not provided"
              }
            />
            <Info
              label="Office Position"
              value={
                userData?.municipal_agriculturist?.position ||
                userData?.provincial_agriculturist?.position
              }
            />
          </div>
        </Section>
      </div>

      <AnimatePresence>
  {isStatusModalOpen && (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
          <h2 className="text-lg font-semibold mb-2">
            {userData.is_active ? "Deactivate User" : "Activate User"}
          </h2>
          <p className="mb-4">
            Are you sure you want to{" "}
            <span className="font-bold text-red-800">
              {userData.is_active ? "deactivate" : "activate"}
            </span>{" "}
            the account{" "}
            <span className="font-medium italic text-gray-800">
              {userData.email}
            </span>{" "}
            for{" "}
            <span className="font-bold text-blue-700">
              {userData?.municipal_agriculturist?.first_name ||
                userData?.provincial_agriculturist?.first_name}{" "}
              {userData?.municipal_agriculturist?.last_name ||
                userData?.provincial_agriculturist?.last_name}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStatus}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {userData.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      </div>
    </>
  )}
</AnimatePresence>

      <SuccessModal
        isOpen={successOpen}
        title="Success"
        message={successMsg}
        onClose={() => {
          setSuccessOpen(false);
          navigate("/admin/users");
        }}
      />

      <AnimatePresence>
  {isEditModalOpen && (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
          <h2 className="text-lg font-semibold mb-2">Edit User</h2>
          <p className="mb-4">
            Do you want to{" "}
            <span className="font-bold text-gray-700">edit</span> the account{" "}
            <span className="font-medium italic text-gray-800">{userData.email}</span>{" "}
            for{" "}
            <span className="font-bold text-blue-700">
              {userData?.municipal_agriculturist?.first_name ||
                userData?.provincial_agriculturist?.first_name}{" "}
              {userData?.municipal_agriculturist?.last_name ||
                userData?.provincial_agriculturist?.last_name}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  )}
</AnimatePresence>
    </div>
  );
};

export default AdminUserProfile;
