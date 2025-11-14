import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { AnimatePresence, motion } from 'framer-motion';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, variant }) => {
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

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={handleBackdropClick}>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/35"
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 340, damping: 20, mass: 0.9 }}
            className="bg-white rounded-2xl w-[400px] overflow-hidden shadow-xl relative z-[10000]"
          >
            {/* Content */}
            <div className="px-6 py-6 text-center">
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
              <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleConfirm}
                className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  variant === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                  variant === 'success' ? 'bg-green-600 hover:bg-green-700' :
                  variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

ConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['primary', 'danger', 'success', 'warning']),
};

ConfirmModal.defaultProps = {
  title: 'Confirm',
  variant: 'primary',
};

export default ConfirmModal;