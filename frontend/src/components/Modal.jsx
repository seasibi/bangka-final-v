import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'framer-motion';

const Modal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  children,
  variant
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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleBackdropClick}
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/40"
          />

          {/* Modal content wrapper to enable pointer events only on panel */}
          <div className="relative z-[10000] pointer-events-none flex items-center justify-center w-full h-full p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 20, mass: 0.9 }}
              className="bg-white rounded-lg w-[450px] overflow-hidden shadow-xl pointer-events-auto"
            >
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
                {/* Icon to match unified modal style */}
                <div className="mx-auto mb-3 flex items-center justify-center h-12 w-12 rounded-full"
                  style={{
                    backgroundColor: (
                      variant === 'danger' ? '#fee2e2' :
                      variant === 'success' ? '#dcfce7' :
                      variant === 'warning' ? '#fef3c7' : '#dbeafe'
                    )
                  }}
                >
                  {variant === 'danger' && (
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#dc2626">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.8A2 2 0 004.53 20h14.94a2 2 0 001.64-3.34l-7.4-12.8a2 2 0 00-3.42 0z" />
                    </svg>
                  )}
                  {variant === 'success' && (
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#16a34a">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {variant === 'warning' && (
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#d97706">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.8A2 2 0 004.53 20h14.94a2 2 0 001.64-3.34l-7.4-12.8a2 2 0 00-3.42 0z" />
                    </svg>
                  )}
                  {(variant === 'primary' || !variant) && (
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="#2563eb">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 14h.01M16 10h.01M12 18h.01M12 6h.01" />
                    </svg>
                  )}
                </div>
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
                      className={`px-4 py-[6px] text-[13px] text-white rounded ${
                        variant === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                        variant === 'success' ? 'bg-green-600 hover:bg-green-700' :
                        variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                        'bg-[#3b82f6] hover:bg-[#2563eb]'
                      }`}
                    >
                      {confirmText}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
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
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'danger', 'success', 'warning']),
};

Modal.defaultProps = {
  confirmText: null,
  cancelText: null,
  message: '',
  variant: 'primary',
};

export default Modal; 