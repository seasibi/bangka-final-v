import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../components/Button";
import Loader from "../../components/Loader";
import Modal from "../../components/Modal";
import { getTracker } from "../../services/trackerService";
import { getDeviceTokenByName, revokeDeviceToken } from "../../services/deviceTokenService";

const ProvisionModal = ({ token, boatId, onClose, onCopyToken, copySuccess }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Provision Device</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">Paste these commands in the ESP32 Serial Monitor (115200 baud rate):</p>
      <div className="rounded-lg border bg-gray-50 p-4 text-sm font-mono space-y-2 mb-4">
        <div className="break-all">
          <span className="text-blue-600">set token </span>
          <span className="break-all">{token}</span>
        </div>
        {typeof boatId === "number" && (
          <div>
            <span className="text-blue-600">set boat </span>
            <span>{boatId}</span>
          </div>
        )}
        <div>
          <span className="text-blue-600">reboot</span>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <div className="flex">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs text-yellow-800 font-medium">Important</p>
            <p className="text-xs text-yellow-700">Token shown only once. Store securely before closing.</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button 
          className={`px-4 py-2 text-sm rounded-lg border transition-colors duration-200 ${
            copySuccess 
              ? 'bg-green-50 border-green-300 text-green-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => onCopyToken(token)}
        >
          {copySuccess ? (
            <>
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Token
            </>
          )}
        </button>
        <button 
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200" 
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  </div>
);

const TrackerView = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // BirukBilugID from URL
  const [tracker, setTracker] = useState(null);
  const [tokenRec, setTokenRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prov, setProv] = useState({ open: false, token: "", boatId: null });
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const t = await getTracker(id);
        setTracker(t);
        const tok = await getDeviceTokenByName(id);
        setTokenRec(tok);
        setError(null);
      } catch (e) {
        setError("Failed to load tracker");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const masked = tokenRec?.masked_token || "—";
  const lastSeen = tokenRec?.last_seen_at ? new Date(tokenRec.last_seen_at).toLocaleString() : "—";


  const handleRevokeClick = () => {
    setRevokeModalOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!tokenRec) return;
    try {
      await revokeDeviceToken(tokenRec.id);
      const tok = await getDeviceTokenByName(id);
      setTokenRec(tok);
      setRevokeModalOpen(false);
    } catch (error) {
      console.error('Failed to revoke token:', error);
      setRevokeModalOpen(false);
    }
  };

  const handleCopyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
    }
  };

  if (loading) return <div className="p-6"><Loader /></div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!tracker) return <div className="p-6">Not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-200"
            aria-label="Go back"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Tracker {tracker.BirukBilugID}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Municipality Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-sm text-gray-500 font-medium">Municipality</div>
                <div className="text-lg font-semibold text-gray-900">{tracker.municipality}</div>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                tracker.status === 'assigned' ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  tracker.status === 'assigned' ? 'text-green-600' : 'text-yellow-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-sm text-gray-500 font-medium">Status</div>
                <div className={`text-lg font-semibold capitalize ${
                  tracker.status === 'assigned' ? 'text-green-600' : 'text-yellow-600'
                }`}>{tracker.status}</div>
              </div>
            </div>
          </div>

          {/* Boat Info Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-sm text-gray-500 font-medium">Boat</div>
                <div className="text-lg font-semibold text-gray-900">
                  {tracker.boat_mfbr ? `MFBR ${tracker.boat_mfbr}` : (tracker.boat || '—')}
                </div>
                {tracker.owner_name && (
                  <div className="text-sm text-gray-500 mt-1">Owner: {tracker.owner_name}</div>
                )}
                {tracker.owner_registration && (
                  <div className="text-sm text-gray-500">Registration: {tracker.owner_registration}</div>
                )}
                {!tracker.boat_mfbr && (
                  <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                    Assign from Boat Registry Management
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Token Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3a1 1 0 011-1h2.586l6.243-6.243A6 6 0 0121 9z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-sm text-gray-500 font-medium">Device Token</div>
                <div className="text-lg font-mono text-gray-900">{masked}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded">
              💡 Token is masked for security. Use “Mark Lost Device” to revoke a compromised token and re-provision a new one.
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleRevokeClick} 
                disabled={!tokenRec || tokenRec?.is_active === false}
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Mark Lost Device
              </button>
            </div>
          </div>

          {/* Last Seen Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <div className="text-sm text-gray-500 font-medium">Last Seen</div>
                <div className="text-lg font-semibold text-gray-900">{lastSeen}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {prov.open && (
        <ProvisionModal 
          token={prov.token} 
          boatId={prov.boatId ?? undefined} 
          onClose={() => setProv({ open: false, token: "", boatId: null })} 
          onCopyToken={handleCopyToken}
          copySuccess={copySuccess}
        />
      )}
      
      {/* Revoke Token Confirmation Modal */}
      <Modal
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        onConfirm={handleConfirmRevoke}
        title="Mark Lost Device"
        message="Are you sure you want to revoke this token? The device will be blocked immediately and cannot reconnect until a new token is provisioned."
        confirmText="Mark Lost Device"
        cancelText="Cancel"
      />
    </div>
  );
};

export default TrackerView;
