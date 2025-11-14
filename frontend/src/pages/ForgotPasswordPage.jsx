import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URLS } from "../services/api_urls";
import Button from "../components/Button";
import Footer from "../components/Footer";
import logo from "../assets/logo.png";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URLS}password-reset/`, {
        email: email.toLowerCase(),
        frontend_url: window.location.origin,
      });

      if (response.status === 200) {
        setSubmitted(true);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to send password reset email"
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
            {!submitted ? (
              <>
                <h2 className="text-3xl font-bold text-center text-blue-900 mb-2">
                  Forgot Password?
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  Enter your email address and we'll send you a link to reset
                  your password.
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
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your email"
                    />
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
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <span>Sending...</span>
                      </div>
                    ) : (
                      "Send Reset Link"
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
                  Check Your Email
                </h2>
                <p className="text-gray-600 mb-6">
                  We've sent a password reset link to{" "}
                  <span className="font-semibold">{email}</span>
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setError("");
                    }}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    try again
                  </button>
                </p>
                <Link
                  to="/login"
                  className="text-blue-600 hover:text-blue-800"
                >
                  Back to Login
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

export default ForgotPasswordPage;
