import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl w-[400px] overflow-hidden shadow-xl">
        {/* Content */}
        <div className="px-6 py-6 text-center">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {title}
            </h3>
          )}
          <p className="text-sm text-gray-600 whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-center gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
};

ConfirmModal.defaultProps = {
  title: 'Confirm',
};

export default ConfirmModal;
