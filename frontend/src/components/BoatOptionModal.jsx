import React from "react";
import Button from "./Button";

const BoatOptionModal = ({ isOpen, onClose, onYes, fisherfolkName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="text-center">
          {/* Question Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg
              className="h-8 w-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 10h.01M12 14h.01M16 10h.01M12 18h.01M12 6h.01"
              />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Boat Ownership
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-6">
            Does fisherfolk <strong>{fisherfolkName}</strong> own a boat?
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={onClose} variant="secondary" className="flex-1">
              No
            </Button>
            <Button onClick={onYes} variant="primary" className="flex-1">
              Yes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoatOptionModal;
