import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import { vbimg1, vbimg2, vbimg3,vbimg4 } from '../../assets/help-user-manual/birukbilugmanagement/viewboundaries/viewboundaries'
import { vtlimg1 } from '../../assets/help-user-manual/birukbilugmanagement/viewtrackerlist/viewtrackerlist'
import { addimg1, addimg2, addimg3, addimg4, addimg5, addimg6, addimg7, addimg8 } from '../../assets/help-user-manual/birukbilugmanagement/add/add'
import { atimg1, atimg2, atimg3, atimg4, atimg5 } from '../../assets/help-user-manual/birukbilugmanagement/assigntracker/assigntracker'
import { utimg1, utimg2, utimg3, utimg4 } from '../../assets/help-user-manual/birukbilugmanagement/unassigntracker/unassigntracker'

const BirukBilugHelp = () => {
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
              BirukBilug Tracking
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              View real-time tracker locations on the map, search by MFBR, and inspect movement history.
            </p>
          </div>
        </div>

        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">View Provincial Map with Boundaries</h2>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>To open visual map, navigate to the “BirukBilug Tracking”</li>
            <img src={vbimg1} alt="" className="my-3 rounded border" />
            <li>Choose which boundaries to display:
              Toggle to view “Water Boundaries” to focus on water areas
            </li>
            <img src={vbimg2} alt="" className="my-3 rounded border" />
            <li>Switch to view “Land Boundaries” if you want to focus on land areas.</li>
            <img src={vbimg3} alt="" className="my-3 rounded border" />
            <li>Use the search bar to find specific boats using MFBR numbers.</li>
            <img src={vbimg4} alt="" className="my-3 rounded border" />
          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-3">Viewing Tracker List</h2>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Click the “View Tracker List” at the top-right.</li>
            <img src={vtlimg1} alt="" className="my-3 rounded border" />
            <li>Scroll down to see all registered trackers</li>
          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Adding a Tracker</h2>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Click the “Add Tracker” button</li>
            <img src={addimg1} alt="" className="my-3 rounded border" />
            <li>Select the Municipality; the tracker ID will generate automatically</li>
            <img src={addimg2} alt="" className="my-3 rounded border" />
            <li>Click “Add Tracker”</li>
            <img src={addimg3} alt="" className="my-3 rounded border" />
            <li>Click “Continue” to confirm</li>
            <img src={addimg4} alt="" className="my-3 rounded border" />
            <li>Copy the generated token.</li>
            <img src={addimg5} alt="" className="my-3 rounded border" />
            <li>Open the Arduino file and paste the token where required.
            <img src={addimg6} alt="" className="my-3 rounded border" /></li>
            <li>Return to the system and click “Done”.</li>
            <img src={addimg7} alt="" className="my-3 rounded border" />
            <li>A success message will appear to indicate that the tracker has been registered</li>
            <img src={addimg8} alt="" className="my-3 rounded border" />
          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Assigning a Tracker to a Boat</h2>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Navigate to the “Boat Registry Management” and click “View Boat Profile”</li>
            <img src={atimg1} alt="" className="my-3 rounded border" />
            <li>Click the “Assign Tracker” button located within the boat profile.</li>
            <img src={atimg2} alt="" className="my-3 rounded border" />
            <li>From the list of available trackers, select the tracker you wish to assign.</li>
            <img src={atimg3} alt="" className="my-3 rounded border" />
            <li>Click the “Assign” button to link the selected tracker to the boat.</li>
            <img src={atimg4} alt="" className="my-3 rounded border" />
            <li>A success message will be displayed on the screen indicating that the tracker has been successfully assigned.</li>
            <img src={atimg5} alt="" className="my-3 rounded border" />
          </ol>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Unassigning a Tracker</h2>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Navigate to the “Boat Registry Management” and click “View Boat Profile”</li>
            <img src={utimg1} alt="" className="my-3 rounded border" />
            <li>Click the “Unassign Tracker” button.</li>
            <img src={utimg2} alt="" className="my-3 rounded border" />
            <li>Confirm the action by clicking “Unassign”.</li>
            <img src={utimg3} alt="" className="my-3 rounded border" />
            <li>A success message will be displayed to indicate that the tracker is unassigned.</li>
            <img src={utimg4} alt="" className="my-3 rounded border" />
          </ol>
        </section>
      </div>
    </div>
  )
}

export default BirukBilugHelp