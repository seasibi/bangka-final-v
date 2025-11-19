import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PageTitle from '../../components/PageTitle';
import ConfirmModal from "../../components/ConfirmModal";
import SuccessModal from "../../components/SuccessModal";

const ExcelImport = () => {
  const navigate = useNavigate();
  const [importType, setImportType] = useState("boat"); // 'boat' or 'fisherfolk'
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setResult({ error: "Please select a file before uploading." });
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    setResult(null);
    setShowConfirmModal(false);
    const formData = new FormData();
    formData.append("file", file);

    try {
      let endpoint = "";
      if (importType === "boat") {
        endpoint = `${API_BASE}/api/boats/import-excel/`;
      } else {
        endpoint = `${API_BASE}/api/fisherfolk/import-excel/`;
      }

      const res = await axios.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      setResult(res.data);
      if (!res.data.error) {
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setResult({ error: err.response?.data?.error || err.message || "Upload failed" });
    }
    setLoading(false);
  };

  const getTitle = () => {
    return importType === "boat" ? "Import Boats from Excel" : "Import Fisherfolk from Excel";
  };

  const getDescription = () => {
    return importType === "boat"
      ? "Upload an Excel file to import multiple boat records"
      : "Upload an Excel file to import multiple fisherfolk records";
  };

  const getSuccessMessage = () => {
    const count = result?.imported || 0;
    return importType === "boat"
      ? `Successfully imported ${count} boat records!`
      : `Successfully imported ${count} fisherfolk records!`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" style={{ fontFamily: 'Montserrat, sans-serif' }} >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">

            {/* Header */}
        <div className="flex items-center gap-4 mb-6">
                    {/* back button */}
          <button type="button" onClick={() => navigate('/admin/utility')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>IMPORT EXCEL FILES</h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {getDescription()}
            </p>
          </div>
         
        </div>

          {/* Import Type Selector */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Import Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="importType"
                  value="boat"
                  checked={importType === "boat"}
                  onChange={(e) => {
                    setImportType(e.target.value);
                    setFile(null);
                    setResult(null);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-2 text-gray-700">Import Boats</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="importType"
                  value="fisherfolk"
                  checked={importType === "fisherfolk"}
                  onChange={(e) => {
                    setImportType(e.target.value);
                    setFile(null);
                    setResult(null);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-2 text-gray-700">Import Fisherfolk</span>
              </label>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose File <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
              {file && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ Selected: {file.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !file}
            >
              {loading ? "Importing..." : "Upload & Import"}
            </button>
          </form>

          {result && (
            <div className="mt-6 space-y-4">
              {/* Main Status */}
              <div className="p-4 rounded-lg border" style={{
                backgroundColor: result.error ? '#FEE2E2' : '#D1FAE5',
                borderColor: result.error ? '#F87171' : '#34D399'
              }}>
                {result.error ? (
                  <div className="text-red-700 font-medium">❌ Error: {result.error}</div>
                ) : (
                  <div>
                    <div className="text-green-700 font-bold text-lg mb-2">
                      ✓ Import Complete
                    </div>
                    <div className="text-gray-700 space-y-1">
                      <div>✅ <strong>{result.imported || 0}</strong> {importType === "boat" ? "boat" : "fisherfolk"} records imported successfully</div>
                      {result.skipped > 0 && (
                        <div>⚠️ <strong>{result.skipped}</strong> rows skipped due to errors</div>
                      )}
                      <div className="text-sm text-gray-600">Total rows processed: {result.total_rows || 0}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-semibold text-blue-800 mb-2">ℹ️ Import Warnings</div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {result.warnings.map((warn, i) => (
                      <li key={i}>{warn.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="font-semibold text-yellow-800 mb-2">
                    ⚠️ Rows with Errors ({result.errors.length})
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <ul className="text-sm text-yellow-700 space-y-2">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <li key={i} className="border-b border-yellow-100 pb-2">
                          <strong>Row {err.row}:</strong>
                          <div className="ml-4 mt-1">
                            {typeof err.errors === 'object' ? (
                              Object.entries(err.errors).map(([field, msg]) => (
                                <div key={field} className="text-xs">
                                  • <span className="font-medium">{field}:</span> {Array.isArray(msg) ? msg.join(', ') : msg}
                                </div>
                              ))
                            ) : (
                              <div className="text-xs">{JSON.stringify(err.errors)}</div>
                            )}
                          </div>
                        </li>
                      ))}
                      {result.errors.length > 20 && (
                        <li className="text-xs text-gray-600 italic">
                          ... and {result.errors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmImport}
        title="Confirm Import"
        message={`Are you sure you want to import ${importType === "boat" ? "boats" : "fisherfolk"} from this Excel file?`}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Import Successful"
        message={getSuccessMessage()}
      />
    </div>
  );
};

export default ExcelImport;