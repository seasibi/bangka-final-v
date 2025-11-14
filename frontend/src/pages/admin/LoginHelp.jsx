import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import { img1, img2 } from '../../assets/help-user-manual/login/login.js'
import { flimg1, flimg2, flimg3, flimg4, flimg5, flimg6, flimg7 } from '../../assets/help-user-manual/login/first-login/first-login.js'
const LoginHelp = () => {
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
              Login
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Steps to Login to the system. This also includes logging in for the first time
            </p>
          </div>
        </div>

        <div className="space-y-6 relative font-montserrat" style={{ fontFamily: "Montserrat, sans-serif" }}>
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> First Time Login </h1>
            <ol className="list-decimal">
              <li className="mb-2 ml-5">Upon created go to your gmail and check your inbox, open the email and find you email and temporary password to log in to the system.</li>
              <img src={flimg1} className="my-3 rounded border"></img>
              <img src={flimg2} className="my-3 rounded border"></img>
              <li className="mb-2 ml-5">Open the system and put your credentials and click <strong>“Log in”</strong> </li>
              <img src={flimg3} className="my-3 rounded border"></img>
              <li className="mb-2 ml-5">Upon log in you are required to change your password immediately then click <strong>“Change Password”</strong>. </li>
              <img src={flimg4} className="my-3 rounded border"></img>
              <img src={flimg5} className="my-3 rounded border"></img>
              <li className="mb-2 ml-5">Upon changing your password you will redirect to the log in page and then put your credentials with your new password that you created and click <strong>“Log in”</strong>. </li>
              <img src={flimg6} className="my-3 rounded border"></img>
              <img src={flimg7} className="my-3 rounded border"></img>
            </ol>
          </div>
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-5" style={{ fontFamily: "Montserrat, sans-serif" }}> Logging In </h1>
            <ol className="list-decimal">
              <li className="mb-2 ml-5">The User must login by entering their respective Email and Password. </li>
              <img src={img1} className="my-3 rounded border"></img>
              <li className="mb-2 ml-5">After a successful login, the Dashboard will appear.  </li>
              <img src={img2} className="my-3 rounded border"></img>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginHelp