import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import {addingimg1, addingimg2, addingimg3, addingimg4, addingimg5} from '../../assets/help-user-manual/boatregistrymanagement/add/add'
import {vimg1, vimg2} from '../../assets/help-user-manual/boatregistrymanagement/view/view'
import {eimg1, eimg2, eimg3, eimg4, eimg5, eimg6, eimg7} from '../../assets/help-user-manual/boatregistrymanagement/edit/edit'
const BoatRegistryHelp = () => {
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
              Boat Registry Management
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Register boats, view and update details, and deactivate inactive boats.
            </p>
          </div>
        </div>

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Adding </h1>
        <ol className="list-decimal ml-6 text-gray-700 space-y-2">
          <li className="mb-2 ml-5">Click <strong>“Add New Boat”</strong>.</li>
            <img src={addingimg1} className="my-3 rounded border"></img>
          <li className="mb-2 ml-5">Search the fisherfolk who owns the boat by Registration Number or Name.</li>
            <img src={addingimg2} className="my-3 rounded border"></img>
          <li className="mb-2 ml-5">Select the fisherfolk by clicking on the “Next” button.</li>
            <img src={addingimg3} className="my-3 rounded border"></img>
          <li className="mb-2 ml-5">Enter the boat details then click “Next”.</li>
            <img src={addingimg4} className="my-3 rounded border"></img>
          <li className="mb-2 ml-5">Click “Continue” to proceed with registration.</li>
          <li className="mb-2 ml-5">A success message will appear if registration is successful</li>
            <img src={addingimg5} className="my-3 rounded border"></img>
          <li className="mb-2 ml-5">The system will ask if another boat from the same fisherfolk will be registered:</li>
             <ul>●	Click “Yes” to be redirected to the Boat Registry Form. </ul>
             <ul>●	Click “No” to be redirected to the Boat Registry List.</ul>
        </ol>
      </section>

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Viewing </h1>
        <ol className="list-decimal ml-6 text-gray-700 space-y-2">
          <li className="mb-2 ml-5">To view a profile, click the “View Boat Profile” button.</li>
          <img src={vimg1} className="my-3 rounded border"></img>
          <li className="mb-2 ml-5">Scroll down to see full details of the boat.</li>
          <img src={vimg2} className="my-3 rounded border"></img>
        </ol>
      </section>

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Editing </h1>
        <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li className="mb-2 ml-5">To modify the details of a boat, click the “Edit” button.</li>
            <img src={eimg1} className="my-3 rounded border"></img>
            <img src={eimg2} className="my-3 rounded border"></img>
            <li className="mb-2 ml-5">Confirm by clicking “Continue” to proceed.</li>
            <img src={eimg3} className="my-3 rounded border"></img>
            <li className="mb-2 ml-5">Once you have reviewed all changes, click “Save Changes” to save these changes.</li>
            <img src={eimg4} className="my-3 rounded border"></img>
            <img src={eimg5} className="my-3 rounded border"></img>
            <li className="mb-2 ml-5">To finalize the registration process, click “Continue”.</li>
            <img src={eimg6} className="my-3 rounded border"></img>
            <li className="mb-2 ml-5">A success message will be displayed on the screen indicating that the boat information has been successfully updated</li>
            <img src={eimg7} className="my-3 rounded border"></img>
          </ol>
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-3">Deactivate</h2>
        <ol className="list-decimal ml-6 text-gray-700 space-y-2">
          <li className="mb-2 ml-5">To deactivate a boat, click the “Deactivate” button.</li>
          <li className="mb-2 ml-5">A success message will be displayed on the screen indicating that the boat information has been successfully deactivated</li>
        </ol>
      </section>
      </div>
    </div>
  )
}

export default BoatRegistryHelp