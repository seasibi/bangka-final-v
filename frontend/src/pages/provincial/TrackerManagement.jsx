import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Button from "../../components/Button";
import Modal from '../../components/Modal';
import axios from "axios";
import Loader from "../../components/Loader";
import { getTrackers } from "../../services/trackerService";
import AddTrackerModal from "../../components/Tracker/AddTrackerModal";

const PATrackerManagement = () => {
  const [trackers, setTrackers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchTrackers();
  }, []);

  const fetchTrackers = async () => {
    try {
      setLoading(true);
      setError(null);

      const trackers = await getTrackers();

      setTrackers(trackers);
      setError(null);
    } catch (err) {
      setError('Failed to fetch trackers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/provincial_agriculturist/birukbilugTracking')}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-200"
              aria-label="Back to tracking map"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <PageTitle value="BirukBilug Management" />
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Add BirukBilug
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-y-auto h-[60vh] w-full">
          <table className="w-full divide-y divide-gray-200">
            <thead className="sticky top-0 w-full">
              <tr className="bg-blue-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Municipality</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...trackers].reverse().map((tracker, index) => (
                <tr key={tracker.BirukBilugID} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{tracker.BirukBilugID}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{tracker.municipality}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        tracker.status === "available"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {tracker.status === "available" ? "Available" : "Assigned"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(tracker.date_added).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add tracker modal */}
        <AddTrackerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCreated={fetchTrackers}
        />
      </div>
    </div>
  );
};

export default PATrackerManagement;
