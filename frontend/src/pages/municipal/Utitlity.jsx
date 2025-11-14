import React from 'react';
import { useNavigate } from 'react-router-dom';

const Utility = () => {
  const navigate = useNavigate();

  const utilityItems = [
    {
      key: 'imports',
      label: 'Import Excel',
      description: 'Import Fisherfolk or Boat data via Excel',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-1h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V7h-2v2z" />
        </svg>
      ),
      color: 'bg-blue-50',
      onClick: () => navigate('/municipal_agriculturist/excelImport'),
    },
    {
      key: 'helpCenter',
      label: 'Help Center',
      description: 'Access help and documentation',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
        </svg>
      ),
      color: 'bg-indigo-50',
      onClick: () => navigate('/municipal_agriculturist/helpCenter'),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="h-full bg-gray-50 px-4 py-6 pb-16">
        {/* Header */}
        <div className="flex items-center mb-8 mt-2">
          <div className="grid grid-cols-1 grid-rows-2">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Utilities Management
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Manage the inside workings of the system
            </p>
          </div>
        </div>

        {/* Utility Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {utilityItems.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`${item.color} p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-left border border-gray-200 hover:border-blue-400`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">{item.icon}</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {item.label}
              </h3>
              <p className="text-sm text-gray-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {item.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Utility;

