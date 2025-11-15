import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import {vlimg1} from '../../assets/help-user-manual/usermanagement/viewlist/viewlist';
import {addimg1, addimg2, addimg3, addimg4, addimg5} from '../../assets/help-user-manual/usermanagement/add/add';
import {vpimg1, vpimg2} from '../../assets/help-user-manual/usermanagement/viewprof/viewprof';
import {eimg1, eimg2, eimg3, eimg4, eimg5, eimg6} from '../../assets/help-user-manual/usermanagement/edit/edit';
import {dimg1, dimg2} from '../../assets/help-user-manual/usermanagement/deac/deac';
const UserManagementHelp = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="h-full bg-gray-50 px-4 py-6 pb-16">
        <div className="flex items-center mb-3 mt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"
          >
            <FaChevronLeft className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "Montserrat, sans-serif" }}>
              User Management
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Create, edit, view roles, and deactivate users. The admin is in-charge for managing roles.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Viewing Users </h1>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Navigate to the “User Management”.</li>
            <img src={vlimg1} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Scroll down to see the list of users</li>
          </ol>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Adding Users</h1>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Click the “Add Users” button.</li>
            <img src={addimg1} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Enter the required user details and click “Next”.</li>
            <img src={addimg2} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Review the information and click “Add Users”.</li>
            <img src={addimg3} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Confirm the action by clicking “Continue”.</li>
            <img src={addimg4} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>A success message will be displayed on the screen indicating that the user has been successfully added.</li>
            <img src={addimg5} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
          </ol>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Viewing the User Profile </h1>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Click “View Profile” next to the desired user.</li>
            <img src={vpimg1} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Scroll down to view additional details.</li>
            <img src={vpimg2} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
          </ol>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Editing the User Profile </h1>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Click the “Edit” button on the user profile.</li>
            <img src={eimg1} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Confirm your intention to edit by clicking “Continue”.</li>
            <img src={eimg2} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Make the necessary changes and click “Next.”</li>
            <img src={eimg3} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Review the updated user details. </li>
            <img src={eimg4} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Click “Update User” to save changes.</li>
            <img src={eimg5} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>A success message will be displayed on the screen indicating that the user has been successfully updated.</li>
            <img src={eimg6} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
          </ol>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Deactivating the User </h1>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Click the “Deactivate” button for the selected user.</li>
            <img src={dimg1} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>Confirm deactivation by clicking “Deactivate” in the prompt.</li>
            <img src={dimg2} alt="" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li>A success message will be displayed on the screen indicating that the user has been successfully deactivated.</li>
          </ol>
        </div>

      </div>
    </div>
  )
}

export default UserManagementHelp