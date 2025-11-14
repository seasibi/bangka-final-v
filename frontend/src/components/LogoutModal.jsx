import useLogout from '../hooks/useLogout'
import Loader from './Loader'

const LogoutIcon = () => (
  <svg
    className="h-6 w-6 text-red-600 mr-2 flex-shrink-0"
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
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
    />
  </svg>
)

const LogoutModal = ({ onClose }) => {
  const { logout, loading } = useLogout()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-brightness-50">
      {loading ? (
        <div className="flex items-center justify-center p-8 bg-white rounded-lg shadow-lg">
          <Loader className="h-16 w-16 text-red-600" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center mb-6">
            <LogoutIcon />
            <h3 className="text-xl font-semibold text-gray-800">
              Confirm Logout
            </h3>
          </div>
          <p className="mb-6 text-gray-600 leading-relaxed">
            Are you sure you want to logout? You will need to log in again to access your account.
          </p>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition"
            >
              Yes, Logout
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 transition"
            >
              No, Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LogoutModal
