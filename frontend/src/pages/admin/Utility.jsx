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
      onClick: () => navigate('/admin/excelImport'),
    },
    {
      key: 'municipalManagement',
      label: 'Municipal Management',
      description: 'Manage municipal settings and configurations',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
        </svg>
      ),
      color: 'bg-gray-50',
      onClick: () => navigate('/admin/municipalManagement'),
    },
    {
      key: 'barangayVerifier',
      label: 'Barangay Verifier Management',
      description: 'Manage barangay verifiers and their assignments',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
        </svg>
      ),
      color: 'bg-purple-50',
      onClick: () => navigate('/admin/barangayVerifierManagement'),
    },
    {
      key: 'signatories',
      label: 'Signatories Management',
      description: 'Manage official signatories',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
        </svg>
      ),
      color: 'bg-green-50',
      onClick: () => navigate('/admin/signatories'),
    },
    {
      key: 'boundaryEditor',
      label: 'Boundary Editor',
      description: 'Edit municipal and barangay boundaries',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
        </svg>
      ),
      color: 'bg-orange-50',
      onClick: () => navigate('/admin/boundaryEditor'),
    },
    {
      key: 'activityLogs',
      label: 'Activity Logs',
      description: 'View system activity logs',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M280-280h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" />
        </svg>
      ),
      color: 'bg-red-50',
      onClick: () => navigate('/admin/utility/activityLog'),
    },
    {
      key: 'backupRestore',
      label: 'Backup & Restore',
      description: 'Create and restore database backups',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="48px"
          viewBox="0 0 24 24"
          width="48px"
          fill="#3863CF"
        >
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 12H5c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1 .45 1 1s-.45 1-1 1zm0-4H5c-.55 0-1-.45-1-1s.45-1 1-1h14c.55 0 1 .45 1 1s-.45 1-1 1z" />
        </svg>
      ),
      color: 'bg-yellow-50',
      onClick: () => navigate('/admin/backupRestore'),
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
      onClick: () => navigate('/admin/helpCenter'),
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
