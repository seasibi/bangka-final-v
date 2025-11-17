import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/Button";
import axios from "axios";
import { API_URLS } from "../services/api_urls";
import logo from "../assets/logo.png";
import Footer from "../components/Footer";
import SuccessModal from "../components/SuccessModal";

const ChangePasswordRequired = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSuccessClose = async () => {
    setSuccessOpen(false);
    await logout();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords
    if (!currentPassword) {
      setError("Current password is required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password cannot be the same as the current password");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URLS}set-new-password/`,
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        // Show success modal, then force re-login on confirm
        setSuccessOpen(true);
        return;
      }
    } catch (error) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError("Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="">
          <div className="flex w-full max-w-md text-center py-5">
            <div className="w-40">
              <img src={logo} alt="BANGKA Logo" className="h-30 w-auto" />
            </div>
            <div className="flex justify-center items-center font-bold text-blue-900 text-lg">
              <h1>Office of the Provincial Agriculturist Fisheries Section</h1>
            </div>
          </div>

          <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 border border-gray-200">
            <h2 className="text-3xl font-bold text-center text-blue-900 mb-2">
              Change Password Required
            </h2>
            <p className="text-center text-gray-600 mb-6">
              You must change your password before continuing
            </p>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 flex items-center space-x-2 p-3 text-sm text-red-700 bg-red-100 border border-red-400 rounded-lg shadow-sm"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter temporary password from email"
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password (min 8 characters)"
                />
                {newPassword && newPassword.length < 8 && (
                  <p className="mt-1 text-xs text-red-600">
                    Password must be at least 8 characters long ({newPassword.length}/8)
                  </p>
                )}
                {newPassword && currentPassword && newPassword === currentPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    New password cannot be the same as current password
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm new password"
                />
                {confirmPassword && newPassword && confirmPassword !== newPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    Passwords do not match
                  </p>
                )}
                {confirmPassword && newPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Passwords match
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className={`w-full py-2 rounded-lg font-semibold transition cursor-pointer ${
                  loading
                    ? "bg-blue-700 cursor-not-allowed"
                    : "bg-blue-900 hover:bg-blue-800 text-white"
                }`}
              >
                {loading ? "Changing Password..." : "Change Password"}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <Footer />

      <SuccessModal
        isOpen={successOpen}
        title="Password changed"
        message="Your password has been updated successfully. Please log in again with your new password."
        onClose={handleSuccessClose}
      />
    </div>
  );
};

export default ChangePasswordRequired;
