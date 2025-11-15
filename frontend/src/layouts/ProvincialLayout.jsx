import React, { useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import LogoutModal from '../components/LogoutModal'
import { Outlet } from 'react-router-dom'

const ProvincialLayout = () => {
  const [showLogout, setShowLogout] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onShowLogout={() => setShowLogout(true)} />
      <div className="flex pt-20">
      <Sidebar />
        <main className="flex-1 ml-79 pb-[calc(var(--footer-h,48px))] min-h-[calc(100vh-80px)]">
        <Outlet />
      </main>
      </div>
      <Footer />
      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}
    </div>
  )
}

export default ProvincialLayout
