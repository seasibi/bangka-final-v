import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'

const NotificationsHelp = () => {
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
              Notifications
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Instructions for navigating the Notifications page, marking items as read, reviewing details, and downloading the PDF report.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}>Navigating the Notifications</h1>
          <ol className="list-decimal ml-6 text-gray-700 space-y-2">
            <li>Open the Notifications page from the sidebar.</li>
            <li>Review the list on the left. Unread items have a blue dot and bold text; read items do not.</li>
            <li>Click a notification to open its details. Opening an unread item automatically marks it as read.</li>
            <li>In the detail view, check the header with the boat name and status “Subjected for Questioning”.</li>
            <li>Under Meta Information, verify the MFBR Number, Tracker Number, Report Number, and Owner.</li>
            <li>Read the incident message: idle duration (minutes), exact coordinates (longitude, latitude), and municipality.</li>
            <li>Check the timestamp to see when the notification was created.</li>
            <li>At the bottom-right, verify the signature block: Prepared by (your account name), Noted by (Provincial Agriculturist), and the date generated.</li>
            <li>Click “Download PDF Report” to generate and save a formatted PDF copy of the report.</li>
            <li>If there are no notifications, the page will display “No notifications”. New alerts will appear when available.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default NotificationsHelp