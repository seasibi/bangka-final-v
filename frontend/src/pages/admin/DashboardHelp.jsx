import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import { dimg1, dimg2, dimg3, dimg4, dimg5, dimg6 } from '../../assets/help-user-manual/dashboard/dashboard.js'

const DashboardHelp = () => {
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
              Dashboard
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Overview of dashboard widgets and quick links. Use the cards to navigate to management pages and view quick statistics.
            </p>
          </div>
        </div>

        <div className="space-y-6 relative font-montserrat" style={{ fontFamily: "Montserrat, sans-serif" }}>

          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Cards </h1>
            <ol className="list-decimal">
              <li className="mb-2 ml-5"><strong>Active Fisherfolk</strong> — shows the number of fisherfolk currently marked as active, including a small percentage change indicator.</li>
              <img src={dimg1} alt="Active Fisherfolk" className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm" />
              <li className="mb-2 ml-5"><strong>Active Boats</strong> — shows the number of boats currently marked as active, including a percentage change indicator.</li>
              <img src={dimg2} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
              <li className="mb-2 ml-5"><strong>Total Fisherfolk</strong> — shows the total registered fisherfolk in the system.</li>
              <img src={dimg3} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
              <li className="mb-2 ml-5"><strong>Total Boats</strong> — shows the total registered boats in the system.</li>
              <img src={dimg4} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
            </ol>
          </div>

          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Charts </h1>
            <ol className="list-decimal">
              <li className="mb-2 ml-5"><strong>Sex Distribution</strong> — bar chart of fisherfolk counts by sex.</li>
              <img src={dimg5} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
              <li className="mb-2 ml-5"><strong>Boats by Municipality</strong> — column chart showing the number of boats per municipality.</li>
              <img src={dimg6} className="my-4 w-full max-w-3xl mx-auto rounded-xl border border-gray-200 shadow-sm"></img>
              <li className="mb-2 ml-5"><strong>Tracker Assignment</strong> — donut chart indicating the count of boats with GPS trackers <em>(Assigned)</em> versus those without <em>(Unassigned)</em>.</li>
              <li className="mb-2 ml-5"><strong>Violations by Municipality</strong> — panel that lists total violations aggregated by municipality and respects the selected date range.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardHelp