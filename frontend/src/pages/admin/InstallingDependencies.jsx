
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import {img1,img2,img3,img4,img5, img6, img7} from '../../assets/help-user-manual/installing-dependencies/installing-depending.js'
import {ximg1,ximg2,ximg3,ximg4,ximg5, ximg6, ximg7, ximg8} from '../../assets/help-user-manual/xampp/xampp.js'
import {mdbimg1,mdbimg2,mdbimg3,mdbimg4,mdbimg5, mdbimg6, mdbimg7, mdbimg8, mdbimg9, mdbimg10} from '../../assets/help-user-manual/mariadb/mariadb.js'
import { rdsimg1, rdsimg2, rdsimg3, rdsimg4, rdsimg5, rdsimg6, rdsimg7 } from '../../assets/help-user-manual/redis/redis.js'
import { ardimg1, ardimg2, ardimg3, ardimg4, ardimg5, ardimg6 } from '../../assets/help-user-manual/arduino/arduino.js'

const AccordionItem = ({ title, children, isOpen, onToggle }) => (
  <div className="border border-gray-200 rounded mb-2">
    <button
      onClick={onToggle}
      className="w-full text-left px-4 py-3 bg-gray-50 flex justify-between items-center"
    >
      <span className="font-medium">{title}</span>
      <span className="text-gray-500">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen && <div className="p-4 text-gray-700">{children}</div>}
  </div>
)

const InstallingDependencies = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState({ vsbasic: false, vscode: false, xampp: false })
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
              Installing Dependencies
            </h1>
            <p className="text-base text-gray-700" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Steps to set up dependencies necessary for the system to work smoothly and efficiently.
            </p>
          </div>
        </div>

            <div className="space-y-6 relative font-montserrat" style={{ fontFamily: "Montserrat, sans-serif" }}>
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <AccordionItem
          title="Visual Studio Basic"
          isOpen={open.vsbasic}
          onToggle={() => setOpen((s) => ({ ...s, vsbasic: !s.vsbasic }))}
        >
            <ol className="list-decimal">
                <li className="mb-2 ml-5">Run the Visual Studio Code Installer, accept the agreement and click <strong>“Next”</strong>.</li>
                  <img src={img1} alt="Installer step 1" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to continue. To select a different folder, click <strong>“Browse”</strong>.</li>
                  <img src={img2} alt="Installer step 2" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to create the program’s shortcut in the Start Menu Folder</li>
                  <img src={img3} alt="Installer step 3" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to continue. Check <strong>“Create desktop icon”</strong> if you want to add an icon in your desktop.</li>
                  <img src={img4} alt="Installer step 4" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Install”</strong> to start the installation.</li>
                  <img src={img5} alt="Installer step 5" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Visual Studio Code is now installing.</li>
                  <img src={img6} alt="Installer step 6" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Finish” </strong>to complete the installation.</li>
                  <img src={img7} alt="Installer step 1" className="my-3 rounded border" />
            </ol>
          
        </AccordionItem>


        <AccordionItem
          title="XAMPP"
          isOpen={open.xampp}
          onToggle={() => setOpen((s) => ({ ...s, xampp: !s.xampp }))}
        >
          <ol className="list-decimal">
                <li className="mb-2 ml-5">Run the XAMPP installer and click <strong>“Next”</strong> to start the installation.</li>
                  <img src={ximg1} alt="XAMPP step 1" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to proceed.</li>
                  <img src={ximg2} alt="XAMPP step 2" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Select the components you want to install and click <strong>“Next”</strong>.</li>
                  <img src={ximg3} alt="XAMPP step 3" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Create a folder where you XAMMP will be installed and click <strong>“Next”</strong>.</li>
                  <img src={ximg4} alt="XAMPP step 4" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Select your preferred language and click <strong>“Next”</strong>.</li>
                  <img src={ximg5} alt="XAMPP step 5" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to begin the installation.</li>
                  <img src={ximg6} alt="XAMPP step 6" className="my-3 rounded border" />
                <li className="mb-2 ml-5">XAMMP is now installing.</li>
                  <img src={ximg7} alt="XAMPP step 7" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Finish”</strong> to complete installation of XAMMP.</li>
                  <img src={ximg8} alt="XAMPP step 8" className="my-3 rounded border" />
            </ol>
        </AccordionItem>

        <AccordionItem
          title="MariaDB"
          isOpen={open.mariaDB}
          onToggle={() => setOpen((s) => ({ ...s, mariaDB: !s.mariaDB }))}
        >
          <ol className="list-decimal">
                <li className="mb-2 ml-5">Visit the official Maria DB web page and download the installer: <strong>https://mariadb.org/download/?t=mariadb&p=mariadb&r=12.0.2&os=windows&cpu=x86_64&pkg=msi&mirror=ossplanet</strong></li>
                  <img src={mdbimg1} alt="MariaDB step 1" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Run the installer and click <strong>“Next”</strong> to continue. </li>
                  <img src={mdbimg2} alt="MariaDB step 2" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Accept the license agreement and click <strong>“Next”</strong>.</li>
                  <img src={mdbimg3} alt="MariaDB step 3" className="my-3 rounded border" />
               <li className="mb-2 ml-5">If XAMPP is installed previously, MariaDB is included but may need to be upgraded. Create a new database instance and click <strong>“Next”</strong>.</li>
                  <img src={mdbimg4} alt="MariaDB step 4" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Click <strong>“Next”</strong> to continue. To select a different folder, click <strong>“Browse”</strong>.</li>
                  <img src={mdbimg5} alt="MariaDB step 5" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Click <strong>“Next”</strong> to proceed with the installation.</li>
                  <img src={mdbimg6} alt="MariaDB step 6" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Click <strong>“Next”</strong> to continue throughout the installation.</li>
                  <img src={mdbimg7} alt="MariaDB step 7" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Click <strong>“Install”</strong> to proceed to the installation of MariaDB.</li>
                  <img src={mdbimg8} alt="MariaDB step 8" className="my-3 rounded border" />
               <li className="mb-2 ml-5">MariaDB is now installing.</li>
                  <img src={mdbimg9} alt="MariaDB step 9" className="my-3 rounded border" />
               <li className="mb-2 ml-5">Click <strong>“Finish”</strong> to complete the MariaDB installation.</li>
                  <img src={mdbimg10} alt="MariaDB step 10" className="my-3 rounded border" />
            </ol>
        </AccordionItem>

        <AccordionItem
          title="Redis Server"
          isOpen={open.redis}
          onToggle={() => setOpen((s) => ({ ...s, redis: !s.redis }))}
        >
          <ol className="list-decimal">
                <li className="mb-2 ml-5">Visit the official website of Memurai web page and download the installer: <strong>https://www.memurai.com/get-memurai</strong></li>
                <li className="mb-2 ml-5">Run the installer and click <strong>“Next”</strong> to continue.</li>
                  <img src={rdsimg1} alt="MariaDB step 2" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Accept the terms and agreement then click <strong>“Next”</strong>.</li>
                  <img src={rdsimg2} alt="MariaDB step 3" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to continue and if you want to choose another folder or drive to store the application click <strong>“Change”</strong>.</li>
                  <img src={rdsimg3} alt="MariaDB step 4" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Next”</strong> to continue the installation.</li>
                  <img src={rdsimg4} alt="MariaDB step 5" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Install”</strong> to proceed in installing the application.</li>
                  <img src={rdsimg5} alt="MariaDB step 6" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Redis Server is now installing.</li>
                  <img src={rdsimg6} alt="MariaDB step 7" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Click <strong>“Finish”</strong> to complete the installation.</li>
                  <img src={rdsimg7} alt="MariaDB step 8" className="my-3 rounded border" />
            </ol>
        </AccordionItem>

        <AccordionItem
          title="Arduino IDE"
          isOpen={open.arduino}
          onToggle={() => setOpen((s) => ({ ...s, arduino: !s.arduino }))}
        >
          <ol className="list-decimal">
                <li className="mb-2 ml-5">First, go to this link to download the installer: <strong>https://www.arduino.cc/en/software</strong></li>
                <li className="mb-2 ml-5">Scroll down until you see this part of the page.</li>
                  <img src={ardimg1} alt="Arduino step 2" className="my-3 rounded border" />
                <li className="mb-2 ml-5">After selecting the right installer (In this case the one for windows 10 or newer), click on <strong>“Download”</strong></li>
                  <img src={ardimg2} alt="Arduino step 3" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Read the terms of Service and click <strong>“I Agree”</strong> if you accept the terms of the agreement.</li>
                  <img src={ardimg3} alt="Arduino step 4" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Select whether you want to make the software for all users (If you have other users) or just for yourself and click <strong>“Next”</strong>.</li>
                  <img src={ardimg4} alt="Arduino step 5" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Choose the location on where you want to install the software and click <strong>“Install”</strong>.</li>
                  <img src={ardimg5} alt="Arduino step 6" className="my-3 rounded border" />
                <li className="mb-2 ml-5">Once the installation is complete, then click <strong>“Finish”</strong> to finish the setup.</li>
                  <img src={ardimg6} alt="Arduino step 7" className="my-3 rounded border" />
            </ol>
        </AccordionItem>

      </div>
    </div>

      </div>
    </div>
  )
}

export default InstallingDependencies