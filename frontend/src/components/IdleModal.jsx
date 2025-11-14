import React from "react";
import Modal from "./Modal";

const IdleModal = ({ isOpen, onStay, onLogout, secondsLeft = 30 }) => {
  return (
    <Modal isOpen={isOpen} onClose={onStay}>
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold mb-4">Are you still there?</h3>
        <p className="text-gray-600 mb-6">
          You have been idle for a while. You will be logged out in {secondsLeft}
          {" "}
          seconds.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onStay}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout Now
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default IdleModal; 