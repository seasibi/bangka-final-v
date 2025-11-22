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
      console.error("Error response data:", err.response?.data);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Upload failed";
      const errorDetails = err.response?.data;
      setResult({ 
        error: errorMessage,
        errors: errorDetails?.errors || [],
        warnings: errorDetails?.warnings || [],
        missing_columns: errorDetails?.missing_columns || []
      });
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
            <button type="button" onClick={() => navigate('/admin/utility')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            {/* title */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>Excel Import</h1>
              <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {getDescription()}
              </p>
            </div>
          </div>

          {/* Import Type Selector */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Select Import Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                importType === "boat" 
                  ? 'border-blue-600 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}>
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
                  className="sr-only"
                />
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    importType === "boat" ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}>
                    {importType === "boat" && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <span className={`font-medium ${importType === "boat" ? 'text-blue-700' : 'text-gray-700'}`}>
                      Import Boats
                    </span>
                  </div>
                </div>
              </label>

              <label className={`relative flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                importType === "fisherfolk" 
                  ? 'border-blue-600 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}>
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
                  className="sr-only"
                />
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    importType === "fisherfolk" ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}>
                    {importType === "fisherfolk" && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className={`font-medium ${importType === "fisherfolk" ? 'text-blue-700' : 'text-gray-700'}`}>
                      Import Fisherfolk
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Template Download Section */}
          <div className="mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Download Import Template
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download the official template file for {importType === "boat" ? "boat" : "fisherfolk"} import. Make sure to follow the exact format and column headers.
                </p>
                <a
                  href={importType === "boat" 
                    ? "/import-templates/boat_import_template.xlsx" 
                    : "/import-templates/fisherfolk_import_template.xlsx"}
                  download={importType === "boat" 
                    ? "boat_import_template.xlsx" 
                    : "fisherfolk_import_template.xlsx"}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download {importType === "boat" ? "Boat" : "Fisherfolk"} Template (.xlsx)
                </a>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-800 bg-blue-100 p-3 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <strong>Important:</strong> Do not modify the column headers in the template. Fill in your data starting from row 2 and maintain the exact format shown in the template.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enhanced File Upload */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Upload Excel File <span className="text-red-500">*</span>
              </label>
              <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 ${
                file 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  {file ? (
                    <>
                      <svg className="mx-auto h-12 w-12 text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-green-700 mb-1">File Selected</p>
                      <p className="text-xs text-green-600">{file.name}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setFile(null);
                        }}
                        className="mt-3 text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        Excel files only (.xlsx)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Submit Button */}
            <button
              type="submit"
              disabled={loading || !file}
              className={`w-full px-6 py-4 text-base font-semibold rounded-xl transition-all duration-200 shadow-lg ${
                loading || !file
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transform hover:scale-[1.02] hover:shadow-xl'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload & Import
                </span>
              )}
            </button>
          </form>

          {result && (
            <div className="mt-8 space-y-4 animate-fadeIn">
              {/* Main Status */}
              <div className={`p-6 rounded-xl border-2 shadow-lg transition-all duration-300 ${
                result.error 
                  ? 'bg-red-50 border-red-300' 
                  : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
              }`}>
                {result.error ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-red-800 mb-1">Import Failed</h3>
                      <p className="text-red-700">{result.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-green-800 mb-2">Import Successful!</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-700">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold text-lg">{result.imported || 0}</span>
                          <span>{importType === "boat" ? "boats" : "fisherfolk"} imported successfully</span>
                        </div>
                        {result.skipped > 0 && (
                          <div className="flex items-center gap-2 text-amber-700">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="font-semibold">{result.skipped}</span>
                            <span>rows skipped</span>
                          </div>
                        )}
                        <div className="text-sm text-green-600 pt-2 border-t border-green-200">
                          Total rows processed: <span className="font-semibold">{result.total_rows || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-xl shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <h4 className="font-bold text-blue-900">Import Warnings ({result.warnings.length})</h4>
                  </div>
                  <ul className="space-y-2">
                    {result.warnings.map((warn, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-blue-800 bg-blue-100 p-2 rounded-lg">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>{warn.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-5 bg-amber-50 border-2 border-amber-200 rounded-xl shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <h4 className="font-bold text-amber-900">Rows with Errors ({result.errors.length})</h4>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <div key={i} className="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
                          <div className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded">Row {err.row}</span>
                          </div>
                          <div className="ml-2 space-y-1">
                            {typeof err.errors === 'object' ? (
                              Object.entries(err.errors).map(([field, msg]) => (
                                <div key={field} className="text-xs text-amber-800 flex items-start gap-2">
                                  <span className="text-amber-500">→</span>
                                  <span>
                                    <span className="font-semibold">{field}:</span>{' '}
                                    {Array.isArray(msg) ? msg.join(', ') : msg}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-amber-800">{JSON.stringify(err.errors)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {result.errors.length > 20 && (
                        <div className="text-center text-sm text-amber-600 italic py-2">
                          ... and {result.errors.length - 20} more errors
                        </div>
                      )}
                    </div>
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