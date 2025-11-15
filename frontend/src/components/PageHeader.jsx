import React from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft } from "react-icons/fa";

const PageHeader = ({ title, subtitle, backTo }) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };
  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        type="button"
        onClick={handleBack}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
      >
        <FaChevronLeft className="w-5 h-5" />
      </button>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );
};

export default PageHeader;