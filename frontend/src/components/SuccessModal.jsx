import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import Button from "./Button";

// Keep this component unchanged for other parts of the app
const SuccessModal = ({ isOpen, title = "Success", message, onClose, fullScreen = false }) => {
  const overlayClass = fullScreen
    ? "fixed inset-0 z-[11000] bg-white/30 backdrop-blur-sm"
    : "fixed inset-0 z-[9998] top-20 bottom-12 left-0 right-0 bg-white/30 backdrop-blur-sm";
  const contentZ = fullScreen ? "z-[11001]" : "z-[9999]";

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [isOpen]);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <div className={overlayClass} />

          {/* Modal content */}
          <div className={`fixed inset-0 flex items-center justify-center p-4 ${contentZ} pointer-events-none`}>
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full pointer-events-auto">
              <div className="text-center">
                {/* Success Icon */}
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-8 w-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                {/* Dynamic Title */}
                <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>

                {/* Message */}
                <p className="text-sm text-gray-600 mb-4">{message}</p>

                {/* OK Button */}
                <div className="mt-5">
                  <Button onClick={onClose} variant="primary" className="w-full">
                    OK
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  // Render at document.body level to avoid parent stacking contexts
  return createPortal(content, document.body);
};

export default SuccessModal;
