import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import ConfirmModal from "../../components/ConfirmModal";
import SuccessModal from "../../components/SuccessModal";
import DuplicateModal from "../../components/DuplicateModal";
import BoatRegistrationForm from "../../components/BoatRegistry/BoatRegistrationForm";

const AddBoat = () => {
  const navigate = useNavigate();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showAnotherModal, setShowAnotherModal] = useState(false);
  const [lastFisherfolk, setLastFisherfolk] = useState(null);
  const [resetKey, setResetKey] = useState(0); // for potential future remounts
  const [anotherAction, setAnotherAction] = useState({ id: 0, reuse: false }); // atomic signal to form
  const [showReuseDetailsModal, setShowReuseDetailsModal] = useState(false);
  const reuseConfirmedRef = useRef(false);
  

  // Called by BoatRegistrationForm on last step submit
  const handleFormSubmit = (data, isLastStep) => {
    if (!isLastStep) return;
    // Store fisherfolk details for next registration
    setLastFisherfolk(
      data.fisherfolk_registration_number
        ? {
            registration_number: data.fisherfolk_registration_number,
            owner_name: data.owner_name,
            owner_address: data.owner_address,
            fishing_ground: data.fishing_ground,
            fma_number: data.fma_number,
            homeport: data.homeport,
          }
        : null
    );
    setShowSuccessModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="h-full bg-gray-50 px-4 py-6 pb-16">
        
      {/* form title */}
        <div className="flex items-center mb-3">
          
          {/* back button */}
          <button type="button" onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>Register New Boat</h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Please fill out the form below to register a new boat.
            </p>
          </div>

        </div>

          <BoatRegistrationForm
            onSubmit={handleFormSubmit}
            anotherAction={anotherAction}
            initialData={
              lastFisherfolk
                ? {
                    fisherfolk_registration_number: lastFisherfolk.registration_number,
                    owner_name: lastFisherfolk.owner_name,
                    owner_address: lastFisherfolk.owner_address,
                    fishing_ground: lastFisherfolk.fishing_ground,
                    fma_number: lastFisherfolk.fma_number,
                    homeport: lastFisherfolk.homeport,
                  }
                : {}
            }
          />


        {/* Success Modal */}
        <SuccessModal
          isOpen={showSuccessModal}
          message="Boat successfully registered!"
          onClose={() => {
            setShowSuccessModal(false);
            setShowAnotherModal(true);
          }}
        />

        {/* Another Boat Modal */}
        <Modal
          isOpen={showAnotherModal}
          title="Register Another Boat?"
          onClose={() => {
            setShowAnotherModal(false);
            navigate("/municipal_agriculturist/boatRegistryManagement");
          }}
        >
          <div className="mb-4">Do you still have another boat to register for this fisherfolk?</div>
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => {
                setShowAnotherModal(false);
                navigate("/municipal_agriculturist/boatRegistryManagement");
              }}
            >
              No
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => {
                // Now show the page-level reuse details prompt
                setShowAnotherModal(false);
                setShowReuseDetailsModal(true);
              }}
            >
              Yes
            </button>
          </div>
        </Modal>

        {/* Reuse latest boat details? Modal (page-level) */}
        <ConfirmModal
          isOpen={showReuseDetailsModal}
          onClose={() => {
            // If confirm just fired, ignore the follow-up onClose from modal
            if (reuseConfirmedRef.current) {
              reuseConfirmedRef.current = false;
              setShowReuseDetailsModal(false);
              return;
            }
            // Cancel => do not reuse
            setShowReuseDetailsModal(false);
            setAnotherAction(prev => ({ id: prev.id + 1, reuse: false }));
          }}
          onConfirm={() => {
            // Confirm => reuse
            reuseConfirmedRef.current = true;
            setShowReuseDetailsModal(false);
            setAnotherAction(prev => ({ id: prev.id + 1, reuse: true }));
          }}
          title="Reuse latest boat details?"
          message={
            `Do you want to reuse these technical details from the latest registered boat?\n\n` +
            `• Boat Type\n` +
            `• Material Used\n` +
            `• Built Place\n` +
            `• Year Built\n` +
            `• Type of Ownership\n` +
            `• Engine Make\n` +
            `• Horsepower\n` +
            `• No. of Fishers\n` +
            `• Registered Length (m)\n` +
            `• Registered Breadth (m)\n` +
            `• Registered Depth (m)\n` +
            `• Tonnage Length\n` +
            `• Tonnage Breadth\n` +
            `• Tonnage Depth\n` +
            `• Gross Tonnage\n` +
            `• Net Tonnage`
          }
        />

        {/* Duplicate Modal */}
        <DuplicateModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          title="Duplicate Boat Entry"
          message="A boat with this name already exists in the system."
        />
      </div>
    </div>
  );
};

export default AddBoat;