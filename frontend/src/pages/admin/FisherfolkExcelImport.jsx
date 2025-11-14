import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft } from "react-icons/fa";
import axios from "axios";
import ConfirmModal from "../../components/ConfirmModal";
import SuccessModal from "../../components/SuccessModal";

const FisherfolkExcelImport = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
      const res = await axios.post("/api/fisherfolk/import-excel/", formData, {
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => navigate('/admin/utility')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
            >
              <FaChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Fisherfolk from Excel</h2>
              <p className="text-gray-600">Upload an Excel file to import multiple fisherfolk records</p>
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
            <div className="mt-6 p-4 rounded-lg border" style={{
              backgroundColor: result.error ? '#FEE2E2' : '#D1FAE5',
              borderColor: result.error ? '#F87171' : '#34D399'
            }}>
              {result.error ? (
                <div className="text-red-700 font-medium">❌ Error: {result.error}</div>
              ) : (
                <div>
                  <div className="text-green-700 font-medium mb-2">✓ Successfully imported {result.imported} fisherfolk records</div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="font-semibold text-yellow-800 mb-2">⚠️ Some rows had errors:</div>
                      <ul className="list-disc ml-6 text-sm text-yellow-700 space-y-1">
                        {result.errors.map((err, i) => (
                          <li key={i}>
                            Row {err.row}: {JSON.stringify(err.errors)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
        message="Are you sure you want to import fisherfolk from this Excel file?"
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Import Successful"
        message={`Successfully imported ${result?.imported || 0} fisherfolk records!`}
      />
    </div>
  );
};

export default FisherfolkExcelImport;
