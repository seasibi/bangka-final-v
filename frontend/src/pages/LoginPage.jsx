import React, { useState } from "react";
import Button from "../components/Button";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Footer from "../components/Footer";
import logo from "../assets/logo.png";
import logosystem from "../assets/logo-system.png";
import Loader from "../components/Loader";
import Header from "../components/Header";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Convert email to lowercase before sending
    const user = await login({ username: username.toLowerCase(), password });  // Backend accepts 'username' but can be email

    if (user) {
      // Add a small delay to ensure context state is fully updated
      setTimeout(() => {
        // Check if user must change password
        if (user.must_change_password) {
          navigate("/change-password-required");
          return;
        }
        
        const role = user.user_role.toLowerCase();
        if (role === "admin") navigate("/admin/dashboard");
        else if (role === "provincial_agriculturist")
          navigate("/provincial_agriculturist/dashboard");
        else if (role === "municipal_agriculturist")
          navigate("/municipal_agriculturist/dashboard");
        else navigate("/");
      }, 100);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header with props to hide greetings and position info */}
      <Header
        onShowLogout={() => {}}
        showUserInfo={false}
      />
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        {loading && (
          <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center z-50">
            <Loader className="h-16 w-16 text-white" />
          </div>
        )}

        <div className="">
          <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 border border-gray-200">
            <div className="flex w-full max-w-md text-center py-5">
            <div className="w-50">
              <img src={logo} alt="BANGKA Logo" className="h-30 w-auto" />
            </div>
            <div className="flex justify-center items-center font-bold text-blue-900 text-lg">
              <h1>Office of the Provincial Agriculturist Fisheries Section</h1>
            </div>
          </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 flex items-center space-x-2 p-3 text-sm text-red-700 bg-red-100 border border-red-400 rounded-lg shadow-sm"
              >
                {/* Error Icon */}
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

                {/* Error Text */}
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="username"
                  autoComplete="email"
                  required
                  value={username}
                 onChange={(e) => {
                    setUsername(e.target.value);
                    clearError(); // Clear error on input change
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                />
                <div className="mt-2 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: '#3863CF' }}
                className={`w-full py-2 rounded-lg font-semibold transition cursor-pointer ${
                  loading
                    ? "bg-blue-700 cursor-not-allowed"
                    : " hover:bg-blue-800 text-white"
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <span>Logging in...</span>
                  </div>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LoginPage;
