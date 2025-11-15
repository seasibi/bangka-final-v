import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

const AlertModal = ({ isOpen, onClose, title, message }) => {
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

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
        {/* Content */}
        <div className="px-6 py-6">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {title}
            </h3>
          )}
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-gray-600 whitespace-pre-line text-left">
              {message}
            </p>
          </div>
        </div>

        {/* OK Button */}
        <div className="flex justify-center px-6 pb-6">
          <button
            onClick={onClose}
            className="px-8 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

AlertModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
};

AlertModal.defaultProps = {
  title: 'Alert Message',
};

export default AlertModal;
