import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

const Modal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  children
}) => {
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-500/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-[450px] overflow-hidden">
        {/* Header */}
        {title && (
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h3 className="text-[15px] font-medium text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4">
          {children ? (
            children
          ) : (
            <p className="text-[13px] text-gray-600">{message}</p>
          )}
        </div>

        {/* Actions */}
        {(confirmText || cancelText) && (
          <div className="flex justify-end gap-3 px-6 py-4">
            {cancelText && (
              <button
                onClick={onClose}
                className="px-4 py-[6px] text-[13px] text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded"
              >
                {cancelText}
              </button>
            )}
            {confirmText && (
              <button
                onClick={onConfirm}
                className="px-4 py-[6px] text-[13px] text-white bg-[#3b82f6] hover:bg-[#2563eb] rounded"
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  children: PropTypes.node
};

Modal.defaultProps = {
  confirmText: null,
  cancelText: null,
  message: ''
};

export default Modal; 