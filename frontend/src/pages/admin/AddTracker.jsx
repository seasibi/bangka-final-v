import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import ConfirmModal from "../../components/ConfirmModal";
import SuccessModal from "../../components/SuccessModal";
import { createTracker, getTrackers } from "../../services/trackerService";
import { createDeviceToken } from "../../services/deviceTokenService";
import Button from "../../components/Button";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useMunicipalities } from "../../hooks/useMunicipalities";

const COASTAL_ONLY = true;

const AddTracker = () => {
  const navigate = useNavigate();
  const { municipalities } = useMunicipalities();
  const [formData, setFormData] = useState({
    BirukBilugID: "",
    municipality: "",
    status: "available",
  });
  const [error, setError] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [provision, setProvision] = useState({ open: false, token: "", boatId: null });

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      // Auto-generate ID on the server based on municipality
      const payload = {
        municipality: formData.municipality,
        status: formData.status,
      };

      const created = await createTracker(payload);
      const fullId = created?.BirukBilugID;

      // Create a device token for this tracker name (BirukBilugID)
      const tokenRes = await createDeviceToken({ name: fullId });

      setIsSubmitModalOpen(false);
      setProvision({ open: true, token: tokenRes.token, boatId: tokenRes.boat_id ?? null });

    } catch (err) {
      let errorMessage = "An error occurred while submitting the form.";
      
      if (err.response?.data) {
        // Handle validation errors from the backend
        if (err.response.data.BirukBilugID) {
          errorMessage = `BirukBilug ID Error: ${err.response.data.BirukBilugID[0]}`;
        } else if (err.response.data.municipality) {
          errorMessage = `Municipality Error: ${err.response.data.municipality[0]}`;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (typeof err.response.data === 'object') {
          // Handle any other field errors
          const firstError = Object.values(err.response.data)[0];
          if (Array.isArray(firstError)) {
            errorMessage = firstError[0];
          } else {
            errorMessage = firstError;
          }
        }
      }
      
      setError(errorMessage);
      setIsSubmitModalOpen(false);
    }
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    setIsCancelModalOpen(false);
    navigate("/admin/trackerManagement");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button
          type="button"
          onClick={() => navigate("/admin/TrackerManagement")}
          variant="icon"
        >
          {/* Back icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </Button>
        <h1 className="text-2xl font-semibold text-gray-800 ml-3">
          Add Tracker
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 max-w-lg mx-auto"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Municipality <span className="text-red-500">*</span>
          </label>
          <Listbox
            value={formData.municipality}
            onChange={(val) => {
              setFormData((prev) => ({
                ...prev,
                municipality: val,
                BirukBilugID: "", // reset when municipality changes
              }));
            }}
          >
            <div className="relative mt-1">
              <Listbox.Button
                required
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
              >
                <span className="block truncate">
                  {formData.municipality || "Select municipality"}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {(municipalities || [])
                  .filter((m) => (COASTAL_ONLY ? m.is_coastal : true))
                  .map((m) => (
                    <Listbox.Option
                      key={m.municipality_id}
                      value={m.name}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                        }`
                      }
                    >
                      {m.name}
                    </Listbox.Option>
                  ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            BirukBilug ID
          </label>
          <div className="flex items-center mt-1">
            <span className="px-3 py-2 bg-blue-600 border border-gray-300 rounded-l-lg text-white font-mono">
              {(() => {
                const m = (municipalities || []).find((x) => x.name === formData.municipality);
                return m && m.prefix ? m.prefix : "XXX";
              })()}
            </span>
            <div className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 bg-gray-50 text-gray-500">
              Will be generated automatically on submit
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Add Tracker
          </button>
        </div>
      </form>

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        title="Register Tracker"
        message="Are you sure you want to register this tracker?"
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Registration"
        message="Are you sure you want to cancel? Any unsaved changes will be lost."
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        message="Tracker has been successfully registered!"
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/trackerManagement");
        }}
      />

      {provision.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">Provision Device</h2>
              <p className="text-sm text-gray-600 mt-2">
                Paste these commands in the ESP32 Serial Monitor (115200):
              </p>
            </div>

            {/* Commands Box */}
            <div className="px-6 pb-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-mono space-y-2 overflow-x-auto">
                <div className="text-gray-800 break-all">set token {provision.token}</div>
                {typeof provision.boatId === "number" && <div className="text-gray-800 break-all">set boat {provision.boatId}</div>}
                <div className="text-gray-800 break-all">reboot</div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                ⚠️ Token is shown only now. Store it securely.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                onClick={async () => {
                  await navigator.clipboard.writeText(provision.token);
                  alert("Token copied to clipboard!");
                }}
              >
                Copy Token
              </button>
              <button
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                onClick={() => {
                  setProvision({ open: false, token: "", boatId: null });
                  setShowSuccessModal(true);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTracker;
