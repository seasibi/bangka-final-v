import React from "react";
import Modal from "./Modal";

const DuplicateModal = ({ isOpen, onClose, title = "Duplicate Entry", message = "This entry already exists in the system." }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-yellow-100 rounded-full p-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-center mb-4">{title}</h3>
        <p className="text-gray-600 text-center mb-4">
          {message}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            OK, I Understand
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DuplicateModal; 