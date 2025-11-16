import React, { useEffect, useState } from "react";
import { apiClient } from "../services/api_urls";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import SuccessModal from "../components/SuccessModal";
import Loader from "../components/Loader";

const MyProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    user_role: "",
    municipality: "",
  });

  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
  });

  const [mode, setMode] = useState("view"); // view | edit
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) {
          setError("User is not loaded.");
          setLoading(false);
          return;
        }
        const res = await apiClient.get(`/users/update/${user.id}/`);
        const data = res.data;

        let firstName = "";
        let lastName = "";
        let municipality = "";

        if (data.municipal_agriculturist) {
          firstName = data.municipal_agriculturist.first_name || "";
          lastName = data.municipal_agriculturist.last_name || "";
          municipality = data.municipal_agriculturist.municipality || "";
        } else if (data.provincial_agriculturist) {
          firstName = data.provincial_agriculturist.first_name || "";
          lastName = data.provincial_agriculturist.last_name || "";
        } else if (data.admin_profile) {
          firstName = data.admin_profile.first_name || "";
          lastName = data.admin_profile.last_name || "";
        }

        const base = {
          first_name: firstName,
          last_name: lastName,
          email: data.email || "",
          user_role: data.user_role || "",
          municipality,
        };

        setProfile(base);
        setEditData({ first_name: firstName, last_name: lastName });
        setLoading(false);
      } catch (err) {
        console.error("Failed to load profile", err);
        setError("Failed to load profile.");
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (!user?.id) {
        setError("User is not loaded.");
        setSaving(false);
        return;
      }

      const payload = {
        first_name: editData.first_name,
        last_name: editData.last_name,
      };

      if (
        profile.user_role === "municipal_agriculturist" &&
        profile.municipality
      ) {
        payload.municipality = profile.municipality;
      }

      await apiClient.put(`/users/update/${user.id}/`, payload);
      setProfile((prev) => ({
        ...prev,
        first_name: editData.first_name,
        last_name: editData.last_name,
      }));
      setMode("view");
      setSaving(false);
      setConfirmOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      console.error("Failed to update profile", err);
      const msg =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        "Failed to update profile.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full px-4 py-7" style={{ fontFamily: "Montserrat, sans-serif" }}>
        <Loader/>
      </div>
    );
  }

  if (error && !saving && mode === "view") {
    return (
      <div
        className="h-full flex items-center justify-center bg-gray-50"
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full">
          <h1 className="text-xl font-semibold text-red-700 mb-2">Error</h1>
          <p className="text-sm text-gray-700 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div
      className="h-full bg-gray-50"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      <div className="h-full px-4 py-7">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="grid grid-cols-1 grid-rows-1 ml-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-3">
              My Profile
            </h1>
            <p className="text-gray-700">View and manage your account details.</p>
          </div>
          {mode === "view" && (
            <div className="mt-3 md:mt-0 mr-2">
              <button
                type="button"
                onClick={() => {
                  setEditData({
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                  });
                  setError(null);
                  setMode("edit");
                }}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col justify-center transform transition-all hover:-translate-y-1 hover:shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {profile.email}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Role</p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {profile.user_role === "provincial_agriculturist"
                  ? "Provincial Agriculturist"
                  : profile.user_role === "municipal_agriculturist"
                  ? "Municipal Agriculturist"
                  : "Administrator"}
              </p>
            </div>
            {profile.user_role === "municipal_agriculturist" && (
              <div>
                <p className="text-sm font-medium text-gray-700">Municipality</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {profile.municipality || "Not provided"}
                </p>
              </div>
            )}
          </div>
          {mode === "view" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">First Name</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {profile.first_name || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Last Name</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {profile.last_name || "Not provided"}
                </p>
              </div>
            </div>
          )}

          {mode === "edit" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
              className="space-y-4"
            >
              {error && (
                <div className="mb-2 p-3 text-sm text-red-700 bg-red-100 rounded">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={editData.first_name}
                    onChange={handleEditChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={editData.last_name}
                    onChange={handleEditChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode("view");
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmSave}
        title="Confirm Profile Update"
        message={
          "Are you sure you want to save these changes to your profile?"
        }
        confirmText={saving ? "Saving..." : "Yes, Save"}
      />

      <SuccessModal
        isOpen={successOpen}
        title="Profile Updated"
        message={
          "Your profile has been updated successfully. Some changes may require re-login to reflect everywhere."
        }
        onClose={() => {
          setSuccessOpen(false);
        }}
      />
    </>
  );
};

export default MyProfile;
