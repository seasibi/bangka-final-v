import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Button from "../../components/Button";
import Modal from '../../components/Modal';
import { apiClient } from "../../services/api_urls";
import Loader from "../../components/Loader";
import { getTrackers } from "../../services/trackerService";
import { useAuth } from '../../contexts/AuthContext';

const MATrackerManagement = () => {
  const [trackers, setTrackers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState(null);
  const navigate = useNavigate();
    const { user } = useAuth();
  
  useEffect(() => {
    fetchTrackers();
  }, []);

  const fetchTrackers = async () => {
    try {
      setLoading(true);
      setError(null);

      const trackers = await getTrackers();

      setTrackers(
        trackers.filter(
      t => t.municipality === user?.municipality
    )
  );
      setError(null);
    } catch (err) {
      setError('Failed to fetch trackers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTracker = () => {
    navigate('/admin/TrackerManagement/add');
  };

  const handleUpdateStatusClick = (tracker) => {
    setSelectedTracker(tracker);
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTracker) return;
    try {
      setError(null);
      await apiClient.put(
        `/birukbilug/${selectedTracker.BirukBilugID}/`,
        {
          ...selectedTracker,
          status: selectedTracker.status === "available" ? "assigned" : "available",
        }
      );
      setIsStatusModalOpen(false);
      fetchTrackers();
    } catch (error) {
      setError("Failed to update status. Please try again.");
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
              onClick={() => navigate('/municipal_agriculturist/birukbilugTracking')}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-200"
              aria-label="Back to tracking map"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <PageTitle value="BirukBilug Management" />
          </div>
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

        {/* Status Update Confirmation Modal */}
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onConfirm={handleUpdateStatus}
          title={selectedTracker?.status === "available" ? "Assign" : "Make Available"}
          message={`Are you sure you want to mark this tracker as ${
            selectedTracker?.status === "available" ? "assigned" : "available"
          }?`}
          confirmText={selectedTracker?.status === "available" ? "Assign" : "Available"}
          cancelText="Cancel"
        />
      </div>
    </div>
  );
};

export default MATrackerManagement;