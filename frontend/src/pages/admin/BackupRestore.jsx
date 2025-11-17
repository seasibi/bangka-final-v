import { useState, useEffect } from 'react';
import { FaDatabase, FaDownload, FaUpload, FaHistory, FaChevronLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { API_URLS } from '../../services/api_urls';
import AlertModal from '../../components/AlertModal';
import ConfirmModal from '../../components/ConfirmModal';
import SuccessModal from '../../components/SuccessModal';
import PageTitle from '../../components/PageTitle';

const BackupRestore = () => {
  const navigate = useNavigate();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [backupHistory, setBackupHistory] = useState([]);
  const [showConfirmBackup, setShowConfirmBackup] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [restoreMode, setRestoreMode] = useState('smart'); // 'smart' or 'full'
  const [importSummary, setImportSummary] = useState(null);

  // pagination for backup history
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];

  useEffect(() => {
    setPage(1);
  }, [pageSize, backupHistory.length]);

  // compute pagination for backupHistory
  const sortedBackups = [...backupHistory].slice().sort((a, b) => {
    // try to sort by date if available (ISO or readable), fallback to original order
    try {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } catch (e) {
      return 0;
    }
  });
  const total = sortedBackups.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginatedBackups = sortedBackups.slice(start, start + pageSize);

  const PaginationControls = ({ page, setPage, pageSize, total }) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 border border-blue-500 border-1 border-b-2 rounded disabled:opacity-50">Prev</button>
        <div className="hidden sm:flex items-center gap-1">
          {pages.slice(0, 10).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`px-2 py-1 border-blue-500 border-1 border-b-2 rounded ${p === page ? 'bg-blue-600 text-white' : 'border'}`}>{p}</button>
          ))}
          {totalPages > 10 && <span className="px-2">...</span>}
        </div>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 border border-blue-500 border-1 border-b-2 rounded disabled:opacity-50">Next</button>
      </div>
    );
  };

  // Load backup history on component mount
  useEffect(() => {
    loadBackupHistory();
  }, []);

  const confirmBackup = () => {
    setShowConfirmBackup(true);
  };

  const openAlert = (title, msg) => {
    setAlertTitle(title);
    setAlertMessage(msg);
    setAlertOpen(true);
  };

  const handleBackup = async () => {
    if (isBackingUp) return; // Prevent multiple simultaneous requests
    
    setShowConfirmBackup(false);
    setIsBackingUp(true);
    
    try {
      const response = await fetch(`${API_URLS}backup/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const fileName = `database_backup_${new Date().toISOString().split('T')[0]}.sql`;

        // Prefer native File System Access API when available
        if (window.showSaveFilePicker) {
          try {
            const opts = {
              suggestedName: fileName,
              types: [
                {
                  description: 'SQL file',
                  accept: { 'application/sql': ['.sql'], 'application/octet-stream': ['.sql'] },
                },
              ],
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            setSuccessMessage('Database backup created and saved successfully!');
            setShowSuccessModal(true);
            await loadBackupHistory();
          } catch (e) {
            // If user cancelled the save picker, abort silently (no download)
            // Other errors should be surfaced
            if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) {
              // user cancelled -> do nothing
            } else {
              console.error('Failed to save backup:', e);
              openAlert('Error', 'Failed to save backup.');
            }
          }
        } else {
          // Fallback: ask user to confirm download location (browser will save to default folder)
          const ok = window.confirm('Choose OK to download the backup file and open it, or Cancel to abort.');
          if (!ok) {
            // user cancelled
            setIsBackingUp(false);
            return;
          }

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          setSuccessMessage('Database backup created and downloaded successfully!');
          setShowSuccessModal(true);
          loadBackupHistory();
        }
      } else {
        openAlert('Error', 'Failed to create backup. Please try again.');
      }
    } catch (error) {
      console.error('Backup error:', error);
      openAlert('Error', 'An error occurred while creating backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const confirmRestore = () => {
    if (!selectedFile) {
      openAlert('Notice', 'Please select a backup file first.');
      return;
    }
    setShowConfirmRestore(true);
  };

  const handleRestore = async () => {
    setShowConfirmRestore(false);
    setIsRestoring(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append('backup_file', selectedFile);
    formData.append('mode', restoreMode);

    try {
      const response = await fetch(`${API_URLS}backup/restore/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        
        // Show import summary for smart restore
        if (data.mode === 'smart' && data.imported) {
          setImportSummary(data.imported);
          const totalRecords = data.total_new_records || 0;
          setSuccessMessage(
            totalRecords > 0 
              ? `Smart restore completed! Imported ${totalRecords} new record(s).`
              : 'Smart restore completed! No new data to import.'
          );
        } else {
          setSuccessMessage(data.message || 'Database restored successfully!');
        }
        
        setShowSuccessModal(true);
        setSelectedFile(null);
        const input = document.getElementById('fileInput');
        if (input) input.value = '';
      } else {
        let data = {};
        try { data = await response.json(); } catch { /* ignore */ }
        openAlert('Error', data.error || 'Failed to restore database.');
      }
    } catch (error) {
      console.error('Restore error:', error);
      openAlert('Error', 'An error occurred while restoring database.');
    } finally {
      setIsRestoring(false);
    }
  };

  const loadBackupHistory = async () => {
    try {
      const response = await fetch(`${API_URLS}backup/history/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBackupHistory(data.backups || []);
      }
    } catch (error) {
      console.error('Error loading backup history:', error);
    }
  };

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6 pb-20" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex items-center gap-4 mt-4 mb-4">
{/* back button */}
          <button type="button" onClick={() => navigate('/admin/utility')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>BARANGAY VERIFIER MANAGEMENT</h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Manage the barangay verifiers per municipality
            </p>
          </div>
</div>

<AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title={alertTitle}
        message={alertMessage}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Backup Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <FaDownload className="text-blue-600 text-2xl mr-3" />
            <h2 className="text-xl font-semibold text-gray-800">Create Backup</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Download a complete backup of your database in SQL format.
          </p>
          <button
            onClick={confirmBackup}
            disabled={isBackingUp}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition ${
              isBackingUp
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <FaDatabase />
            {isBackingUp ? 'Creating Backup...' : 'Create Backup'}
          </button>
        </div>

        {/* Restore Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <FaUpload className="text-green-600 text-2xl mr-3" />
            <h2 className="text-xl font-semibold text-gray-800">Restore Database</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Upload a backup file to restore your database.
          </p>
          <div className="mb-4">
            <input
              type="file"
              id="fileInput"
              accept=".sql,.zip"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>
          {selectedFile && (
            <p className="text-sm text-gray-600 mb-4">
              Selected: {selectedFile.name}
            </p>
          )}
          
          {/* Restore Mode Selector */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Restore Mode:
            </label>
            
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  value="smart"
                  checked={restoreMode === 'smart'}
                  onChange={(e) => setRestoreMode(e.target.value)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">Smart Restore (Recommended)</span>
                  <p className="text-xs text-gray-600">Automatically detects and imports only new/missing data. Safe - won't overwrite existing data.</p>
                </div>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="restoreMode"
                  value="full"
                  checked={restoreMode === 'full'}
                  onChange={(e) => setRestoreMode(e.target.value)}
                  className="w-4 h-4 text-red-600 focus:ring-red-500"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">Full Restore ⚠️</span>
                  <p className="text-xs text-gray-600">Drops entire database and restores from backup. WARNING: All current data will be lost!</p>
                </div>
              </label>
            </div>
          </div>
          
          <button
            onClick={confirmRestore}
            disabled={isRestoring || !selectedFile}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition ${
              isRestoring || !selectedFile
                ? 'bg-gray-400 cursor-not-allowed'
                : restoreMode === 'smart' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <FaUpload />
            {isRestoring ? 'Restoring...' : (restoreMode === 'smart' ? 'Smart Restore' : 'Full Restore')}
          </button>
        </div>
      </div>

      {/* Backup History Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-24">
        <div className="flex items-center mb-4">
          <FaHistory className="text-gray-600 text-2xl mr-3" />
          <h2 className="text-xl font-semibold text-gray-800">Backup History</h2>
        </div>
        
        {backupHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No backup history available</p>
        ) : (
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-700">Rows per page:</label>
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-blue-500 border-1 border-b-2 rounded px-2 py-1 text-sm">
                  {pageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div className="text-sm text-gray-600">Total: {backupHistory.length}</div>
              </div>
              <PaginationControls page={page} setPage={setPage} pageSize={pageSize} total={backupHistory.length} />
            </div>

            <div className="overflow-y-auto max-h-[60vh] rounded-b">
            <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-0">
                <tr style={{ backgroundColor: "#3863CF", fontFamily: "Montserrat, sans-serif" }}>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBackups.map((backup, index) => {
                    const rowIndex = start + index;
                    return (
                      <tr key={start + index} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{backup.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{backup.size}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{backup.status}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium"><button className="text-blue-600 hover:text-blue-900">Download</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Import Summary (Smart Restore) */}
      {importSummary && Object.keys(importSummary).length > 0 && (
        <div className="mt-6 bg-green-50 border-l-4 border-green-400 p-4">
          <h3 className="text-sm font-semibold text-green-800 mb-2">Import Summary:</h3>
          <div className="space-y-1">
            {Object.entries(importSummary).map(([table, count]) => (
              <p key={table} className="text-sm text-green-700">
                <strong>{table}:</strong> +{count} new record(s)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Smart Restore (Recommended):</strong> Safely imports only new/missing data without overwriting existing records. Perfect for recovering accidentally deleted data.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              <strong>Full Restore:</strong> Completely replaces the database. Only use this if you want to roll back to a previous state entirely.
            </p>
          </div>
        </div>

      </div>

    </div>

      <ConfirmModal
        isOpen={showConfirmBackup}
        onClose={() => setShowConfirmBackup(false)}
        onConfirm={handleBackup}
        title="Create Database Backup"
        message="Are you sure you want to create a complete database backup?"
      />

      <ConfirmModal
        isOpen={showConfirmRestore}
        onClose={() => setShowConfirmRestore(false)}
        onConfirm={handleRestore}
        title={restoreMode === 'smart' ? "Smart Restore" : "⚠️ Full Restore"}
        message={
          restoreMode === 'smart'
            ? `This will analyze ${selectedFile?.name} and import only new/missing data. Existing data will be preserved. Continue?`
            : `⚠️ WARNING: This will DROP THE ENTIRE DATABASE and replace it with ${selectedFile?.name}. All current data will be lost! This action cannot be undone. Are you absolutely sure?`
        }
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        message={successMessage}
      />
    </div>
  );
};

export default BackupRestore;
