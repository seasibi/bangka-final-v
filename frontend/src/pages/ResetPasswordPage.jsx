import React, { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_URLS } from "../services/api_urls";
import Button from "../components/Button";
import Footer from "../components/Footer";
import logo from "../assets/logo.png";

const ResetPasswordPage = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordsMatch = useMemo(() => confirmPassword.length > 0 && newPassword === confirmPassword, [newPassword, confirmPassword]);
  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!newPassword || !confirmPassword) return false;
    if (newPassword.length < 8) return false;
    if (!passwordsMatch) return false;
    return true;
  }, [loading, newPassword, confirmPassword, passwordsMatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      if (!passwordsMatch) setError("Passwords do not match");
      else if (newPassword.length < 8) setError("Password must be at least 8 characters long");
      else setError("Please complete all fields");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URLS}password-reset-confirm/${uid}/${token}/`,
        {
          new_password: newPassword,
          confirm_password: confirmPassword,
        }
      );

      if (response.status === 200) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to reset password. The link may be invalid or expired."
      );
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
            {!success ? (
              <>
                <h2 className="text-3xl font-bold text-center text-blue-900 mb-6">
                  Reset Password
                </h2>

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
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="newPassword"
                        autoComplete="new-password"
                        required
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="confirmPassword"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError("");
                      }}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirm new password"
                    />
                    {confirmPassword && (
                      <p className={`mt-1 text-xs ${passwordsMatch ? "text-green-600" : "text-red-600"}`}>
                        {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className={`w-full py-2 rounded-lg font-semibold transition cursor-pointer ${
                      !canSubmit
                        ? "bg-blue-700 cursor-not-allowed text-white"
                        : "bg-blue-900 hover:bg-blue-800 text-white"
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <span>Resetting...</span>
                      </div>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Back to Login
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 text-green-500 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Password Reset Successful!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your password has been successfully reset. You will be
                  redirected to the login page in a few seconds.
                </p>
                <Link
                  to="/login"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Go to Login Now
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
