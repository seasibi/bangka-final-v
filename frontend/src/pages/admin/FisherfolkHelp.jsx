import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import { addimg1, addimg2, addimg3, addimg4, addimg5, addimg6 } from '../../assets/help-user-manual/fisherfolkmanagement/add/add'
import {vimg1, vimg2} from '../../assets/help-user-manual/fisherfolkmanagement/view/view'
import { eimg1, eimg2, eimg3, eimg4, eimg5, eimg6 } from '../../assets/help-user-manual/fisherfolkmanagement/edit/edit'
import {dimg1, dimg2, dimg3} from '../../assets/help-user-manual/fisherfolkmanagement/deac/deac'
const FisherfolkHelp = () => {
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
              Fisherfolk Management
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Add, view, edit, and deactivate fisherfolk records.
            </p>
          </div>
        </div>

        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Adding </h1>
          <ol className="list-decimal ml-10 text-gray-700 space-y-2">
            <li className="mb-2 ml-5">Navigate the sidebar, click on the Fisherfolk Management, then select <strong>“Add Fisherfolks”</strong>.</li>
            <img src={addimg1} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
            <li className="mb-2 ml-5">Enter fisherfolk’s details then click <strong>“Next”</strong>. </li>
            <img src={addimg2} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Review the information and click <strong>“Create Fisherfolk”</strong> to register the fisherfolk. </li>
            <img src={addimg3} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <img src={addimg4} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Click <strong>“Continue”</strong> to proceed with fisherfolk registration. </li>
            <li className="mb-2 ml-5">A success message will confirm registration.</li>
            <img src={addimg5} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5"><strong>Registering a Boat (if applicable) If the fisherfolk owns a boat:</strong>
              <ul className="mt-2 list-disc ml-6 space-y-1 text-gray-700 leading-relaxed">
                <li>
                  If the fisherfolk owns a boat, click <span className="font-medium">“Yes”</span> to be redirected to the Boat Registry Form.
                </li>
                <li>
                  If not, click <span className="font-medium">“No”</span> to be redirected back to the Fisherfolk Management.
                </li>
              </ul>
            </li>
              <img
                src={addimg6}
                alt="Prompt asking if fisherfolk owns a boat with Yes/No options"
                className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"
              />

          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Viewing </h1>
          <ol className="list-decimal ml-10 text-gray-700 space-y-2">
            <li className="mb-2 ml-5">To view a profile, click the <strong>“View Profile”</strong> button.</li>
              <img src={vimg1} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Scroll down to see full details of the fisherfolk.</li>
              <img src={vimg2} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Editing </h1>
          <ol className="list-decimal ml-10 text-gray-700 space-y-2">
            <li className="mb-2 ml-5">Click “Edit” on the profile to modify the fisherfolk profile.</li>
              <img src={eimg1} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Confirm by clicking "Continue" to proceed with editing.</li>
              <img src={eimg2} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Make the necessary changes to the fisherfolk's information</li>
              <img src={eimg3} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Click “Update Fisherfolk” to apply the changes.</li>
              <img src={eimg4} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Review updated details and click “Update”.</li>
              <img src={eimg5} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">A success message will confirm the update.</li>
              <img src={eimg6} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Deactivating </h1>
          <ol className="list-decimal ml-10 text-gray-700 space-y-2">
            <li className="mb-2 ml-5">If fisherfolk is inactive, click “Deactivate”.</li>
              <img src={dimg1} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img> 
            <li className="mb-2 ml-5">Confirm to “Deactive” the chosen fisherfolk.</li>
              <img src={dimg2} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            <li className="mb-2 ml-5">Deactivated fisherfolk can be viewed at the bottom of the table.</li>
              <img src={dimg3} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
          </ol>
        </section>
      </div>
    </div>
  )
}

export default FisherfolkHelp