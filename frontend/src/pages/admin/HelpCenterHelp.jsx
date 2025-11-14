import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'

const HelpCenterHelp = () => {
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
              Help Center
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              This Help Center provides topic pages for easy navigation. Use the back link to return to the main Help Center topics.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpCenterHelp