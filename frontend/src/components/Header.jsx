import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ onShowLogout, showUserInfo = true }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleProfileClick = () => {
    if (!user || !user.user_role) return;

    const role = user.user_role;
    let basePath = '/admin';
    if (role === 'provincial_agriculturist') {
      basePath = '/provincial_agriculturist';
    } else if (role === 'municipal_agriculturist') {
      basePath = '/municipal_agriculturist';
    }

    navigate(`${basePath}/profile`);
    setMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 flex flex-col sm:flex-row items-center justify-between px-6 py-3 text-white h-20 z-20 font-montserrat" style={{ backgroundColor: '#3863CF', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Left side: Logo and title */}
      <div className="flex items-center w-full sm:w-auto">
        <div className="flex-shrink-0">
          <img src={logo} alt="BANGKA Logo" className="h-10 w-auto" />
        </div>
        <div>
          <div className="mt-2 sm:mt-0 sm:ml-5 text-white font-bold text-xl leading-tight text-center sm:text-left max-w-5xl border-color-1 font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Boat Automated Network &amp; GPS Keeper for Awareness (BANGKA)
          </div>
          <hr className="my-1 ml-5 border-white bold-10 opacity-60" />
          <div className="sm:ml-5 text-white font-semibold text-base leading-tight text-center sm:text-left max-w-5xl font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Office of the Provincial Agriculturist - Fisheries Section
          </div>
        </div>

      </div>

      {/* Right side: Notifications and User greeting/info */}
      <div className="flex items-center space-x-4">
        {/* User greeting and info */}
        <div className="mt-4 sm:mt-0 sm:ml-5 w-full sm:w-auto max-w-md font-montserrat" style={{ backgroundColor: '#3863CF', fontFamily: 'Montserrat, sans-serif' }}>
          {showUserInfo && (
            <>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-3" height="24px" viewBox="0 -960 960 960" width="24px" fill="white" aria-hidden="true" focusable="false">
                  <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-164q-59 0-99.5-40.5T340-580q0-59 40.5-99.5T480-720q59 0 99.5 40.5T620-580q0 59-40.5 99.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q53 0 100-15.5t86-44.5q-39-29-86-44.5T480-280q-53 0-100 15.5T294-220q39 29 86 44.5T480-160Zm0-360q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-60Zm0 360Z" />
                </svg>
                <div className="relative flex items-center text-base font-semibold font-montserrat" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  <span>
                    Greetings{user && (user.first_name || user.username || user.email)
                      ? `, ${user.first_name || user.username || user.email}!`
                      : '!'}
                  </span>
                </div>
              </div>

              {/* User info below greeting */}
              <div className="text-white font-semibold text-right font-montserrat ml-9" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {user && user.user_role && (
                  <div>
                    <span className="font-medium">
                      {user.user_role === "municipal_agriculturist"
                        ? <>
                          {user.municipality && <span className="font-bold">{user.municipality}</span>} {"Municipal Agriculturist"}
                        </>
                        : user.user_role === "provincial_agriculturist"
                          ? "Provincial Agriculturist"
                          : "Administrator"}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {user && showUserInfo && (
          <div className="ml-2 relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen((prev) => !prev);
              }}
              type="button"
              aria-label="Open user menu"
            >
              <span className="sr-only">Open user menu</span>
              <svg class="w-4 h-4 ms-1.5 -me-0.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" /></svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white text-gray-800 rounded-md shadow-lg z-30">
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onShowLogout();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

  );
};

export default Header;