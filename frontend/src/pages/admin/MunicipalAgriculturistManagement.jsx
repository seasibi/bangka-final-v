import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import { apiClient } from '../../services/api_urls';
import Loader from "../../components/Loader";
import Modal from '../../components/Modal';
import { logActivity } from '../../utils/activityLog';
import { useAuth } from '../../contexts/AuthContext';

const AdminMunicipalAgriManagement = () => {
  const navigate = useNavigate();
  const [agriculturists, setAgriculturists] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAgri, setSelectedAgri] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchAgriculturists();
  }, []);

  const fetchAgriculturists = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get("/users/", {
        params: {
          role: 'municipal_agriculturist'
        }
      });

      try {
        await logActivity({
          action: 'User Management',
          description: 'Retrieved all municipal agriculturist records'
        });
      } catch (logErr) {
        console.error('Activity log failed:', logErr);
      }
      
      setAgriculturists(response.data.filter(user => user.user_role === 'municipal_agriculturist' && user.is_active));
    } catch (error) {
      console.error("Error fetching agriculturists:", error);
      setError("Failed to fetch agriculturist data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user) => {
    setSelectedAgri(user);
    setIsEditModalOpen(true);
  }

  const handleEdit = async () => {
    if (!selectedAgri) return;

    try {
      const municipalAgriId = selectedAgri.municipal_agriculturist.municipal_agriculturist_id;
      console.log("Selected Municipal Agriculturist ID:", municipalAgriId);
      setIsEditModalOpen(false);
      navigate(`/admin/municipal-agriculturist/edit/${municipalAgriId}`, {
        state: { userData: selectedAgri }
      });
    } catch (error) {
      console.error("Error navigating to edit page:", error);
      setError("Failed to navigate to edit page. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <Loader/>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-7">
      <div className="flex justify-between items-center mb-6">
        <PageTitle value="Municipal Agriculturist Management" />
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      {/* Agriculturist List */}
      <div className="bg-white rounded-lg shadow overflow-y-auto h-[50vh] sm:h-[60vh] md:h-[65vh] lg:h-[70vh] xl:h-[70vh] 2xl:h-[76vh] w-full">
          <table className="w-full divide-y divide-gray-200">
            <thead className="sticky top-0 w-full">
              <tr className="bg-blue-600">
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agriculturists.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No municipal agriculturists found
                  </td>
                </tr>
              ) : (
                [...agriculturists].reverse().map((person, index) => (
                  <tr key={person.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-sm">
                      {person.email}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      Municipal Agriculturist
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-green-600 font-medium">
                        {person.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleEditClick(person)}
                        className="text-white bg-blue-700 py-1 px-2 hover:bg-blue-500 mr-4 rounded-md"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

          <Modal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onConfirm={handleEdit}
            title="Edit User"
            message={
              selectedAgri && selectedAgri.municipal_agriculturist
                ? `Are you sure you want to edit ${selectedAgri.municipal_agriculturist.first_name} ${selectedAgri.municipal_agriculturist.middle_name} ${selectedAgri.municipal_agriculturist.last_name}'s information?`
                : "Are you sure you want to edit this user's information?"
            }
            confirmText="Continue"
            cancelText="Cancel"
          />
      </div>
      </div>
  );
};

export default AdminMunicipalAgriManagement;