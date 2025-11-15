import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import { apiClient } from "../../services/api_urls";
import Loader from "../../components/Loader";
import { useAuth } from "../../contexts/AuthContext";

const AdminUserManagement = () => {
  const navigate = useNavigate();
  // pagination controls (same pattern as FisherfolkManagement)
  const PaginationControls = ({ page, setPage, pageSize, total }) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 border rounded disabled:opacity-50">Prev</button>
        <div className="hidden sm:flex items-center gap-1">
          {pages.slice(0, 10).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`px-2 py-1 rounded ${p === page ? 'bg-blue-600 text-white' : 'border'}`}>{p}</button>
          ))}
          {totalPages > 10 && <span className="px-2">...</span>}
        </div>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
      </div>
    );
  };

  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');

  // reset page when pageSize or users length changes
  useEffect(() => {
    setPage(1);
  }, [pageSize, users.length]);

  // compute pagination/sorted rows for rendering
  const filtered = users.filter(u => statusFilter === 'all' ? true : statusFilter === 'active' ? u.is_active : !u.is_active);
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1; // Active first
    if (!a.is_active && !b.is_active) {
      try {
        const map = JSON.parse(localStorage.getItem('users_last_deactivated') || '{}');
        const ta = typeof map[a.id] === 'number' ? map[a.id] : Number(map[a.id]) || 0;
        const tb = typeof map[b.id] === 'number' ? map[b.id] : Number(map[b.id]) || 0;
        if (ta !== tb) return tb - ta; // latest deactivation first
      } catch { }
    }
    return (b.id || 0) - (a.id || 0);
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginatedRows = sorted.slice(start, start + pageSize);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("All cookies:", document.cookie);
      console.log("Fetching users with apiClient...");

      const response = await apiClient.get("/users/");


      setUsers(response.data.filter((user) => user.user_role !== "admin"));
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to fetch user data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatusClick = (user) => {
    setSelectedUser(user);
    console.log("Selected user for status update:", user);
    setIsStatusModalOpen(true);
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedUser) return;

    try {
      setError(null);

      await apiClient.put(`/users/update/${selectedUser.id}/`, {
        is_active: !selectedUser.is_active,
      });

      // Track last deactivation locally
      try {
        const map = JSON.parse(localStorage.getItem('users_last_deactivated') || '{}');
        if (selectedUser.is_active) {
          map[selectedUser.id] = Date.now();
        } else {
          delete map[selectedUser.id];
        }
        localStorage.setItem('users_last_deactivated', JSON.stringify(map));
      } catch { }

      setIsStatusModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating status:", error);
      setError("Failed to update user status. Please try again.");
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;

    try {
      setIsEditModalOpen(false);
      navigate(`/admin/users/edit/${selectedUser.id}`, {
        state: { userData: selectedUser },
      });
    } catch (error) {
      console.error("Error navigating to edit:", error);
      setError("Failed to navigate to edit page. Please try again.");
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
      <div
        className="h-full px-4 py-6"
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <div className="flex justify-between items-center">
          <div className="grid grid-cols-1 grid-rows-2 ml-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              USER MANAGEMENT
            </h1>
            <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Manage users
            </p>
          </div>
          <Button
            onClick={() => navigate("/admin/users/add")}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            style={{
              backgroundColor: "#3863CF",
              fontFamily: "Montserrat, sans-serif",
            }}
          >
            {" "}
            Add User
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        {/* User List */}
        <div className="bg-white rounded-lg shadow w-full font-montserrat p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Rows per page:</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
                {pageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div className="text-sm text-gray-600">Total: {filtered.length}</div>
              <label className="ml-4 text-sm text-gray-700">Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <PaginationControls page={page} setPage={setPage} pageSize={pageSize} total={filtered.length} />
          </div>

          <div className="overflow-y-auto max-h-[60vh] rounded-b">
            <table className="w-full divide-y divide-gray-200">
              <thead className="sticky top-0 z-10">
                <tr style={{ backgroundColor: "#3863CF", fontFamily: "Montserrat, sans-serif" }}>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No users found</td></tr>
                ) : (
                  paginatedRows.map((userRow, index) => (
                    <tr key={userRow.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">{userRow.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{userRow.user_role === "provincial_agriculturist" ? "Provincial Agriculturist" : userRow.user_role === "municipal_agriculturist" ? "Municipal Agriculturist" : "Admin"}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 text-xs font-medium rounded-full ${userRow.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{userRow.is_active ? "Active" : "Inactive"}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => navigate(`/admin/users/profile/${userRow.id}`, { state: { userData: userRow } })} className="text-white bg-blue-700 py-1 px-3 hover:bg-blue-500 rounded-md">View User Profile</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Update Confirmation Modal */}
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onConfirm={handleUpdateStatus}
          title={selectedUser?.is_active ? "Deactivate User" : "Activate User"}
          message={
            <span>
              Are you sure you want to{" "}
              <span className="font-bold text-red-800">
                {selectedUser?.is_active ? "deactivate" : "activate"}
              </span>{" "}
              the account{" "}
              <span className="font-medium italic text-gray-800">
                {selectedUser?.email}
              </span>{" "}
              for{" "}
              <span className="font-bold text-blue-700">
                {selectedUser?.municipal_agriculturist?.first_name ||
                  selectedUser?.provincial_agriculturist?.first_name}{" "}
                {selectedUser?.municipal_agriculturist?.last_name ||
                  selectedUser?.provincial_agriculturist?.last_name}
              </span>
              ?
            </span>
          }
          confirmText={selectedUser?.is_active ? "Deactivate" : "Activate"}
          cancelText="Cancel"
        />

        {/* Edit Confirmation Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onConfirm={handleEdit}
          title="Edit User"
          message={
            <span>
              Do you want to{" "}
              <span className="font-bold text-gray-700">edit</span> the account{" "}
              <span className="font-medium italic text-gray-800">
                {selectedUser?.email}
              </span>{" "}
              for{" "}
              <span className="font-bold text-blue-700">
                {selectedUser?.municipal_agriculturist?.first_name ||
                  selectedUser?.provincial_agriculturist?.first_name}{" "}
                {selectedUser?.municipal_agriculturist?.last_name ||
                  selectedUser?.provincial_agriculturist?.last_name}
              </span>
              ?
            </span>
          }
          confirmText="Continue"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
};

export default AdminUserManagement;
