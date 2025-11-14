import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import React from "react";

const menuItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: (role) => `/${role}/dashboard`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg
        className="w-6 h-6"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="white"
        viewBox="0 0 24 24"
      >
        <path d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm14 18a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4ZM5 11a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5Zm14 2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4Z" />
      </svg>
    ),
  },


  {
    key: "fisherfolkManagement",
    label: "Fisherfolk Management",
    to: (role) => `/${role}/fisherfolkManagement`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="100px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#1f1f1f"
      >
        <path d="M80-40v-80h40q32 0 62-10t58-30q28 20 58 30t62 10q32 0 62.5-10t57.5-30q28 20 58 30t62 10q32 0 62.5-10t57.5-30q27 20 57.5 30t62.5 10h40v80h-40q-31 0-61-7.5T720-70q-29 15-59 22.5T600-40q-31 0-61-7.5T480-70q-29 15-59 22.5T360-40q-31 0-61-7.5T240-70q-29 15-59 22.5T120-40H80Zm280-160q-36 0-67-17t-53-43q-17 18-37.5 32.5T157-205q-41-11-83-26T0-260q54-23 132-47t153-36l54-167q11-34 41.5-45t57.5 3l102 52 113-60 66-148-20-53 53-119 128 57-53 119-53 20-148 334q93 11 186.5 38T960-260q-29 13-73.5 28.5T803-205q-25-7-45.5-21.5T720-260q-22 26-53 43t-67 17q-36 0-67-17t-53-43q-22 26-53 43t-67 17Zm203-157 38-85-61 32-70-36-28 86h38q21 0 42 .5t41 2.5Zm-83-223q-33 0-56.5-23.5T400-660q0-33 23.5-56.5T480-740q33 0 56.5 23.5T560-660q0 33-23.5 56.5T480-580Z" />
      </svg>
    ),
  },
  {
    key: "boatRegistryManagement",
    label: "Boat Registry Management",
    to: (role) => `/${role}/boatRegistryManagement`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="white"
      >
        <path d="m120-420 320-460v460H120Zm153-80h87v-125l-87 125Zm227 80q12-28 26-98t14-142q0-72-13.5-148T500-920q61 18 121.5 67t109 117q48.5 68 79 149.5T840-420H500Zm104-80h148q-17-77-55.5-141T615-750q2 21 3.5 43.5T620-660q0 47-4.5 87T604-500ZM360-200q-36 0-67-17t-53-43q-14 15-30.5 28T173-211q-35-26-59.5-64.5T80-360h800q-9 46-33.5 84.5T787-211q-20-8-36.5-21T720-260q-23 26-53.5 43T600-200q-36 0-67-17t-53-43q-22 26-53 43t-67 17ZM80-40v-80h40q32 0 62.5-10t57.5-30q27 20 57.5 29.5T360-121q32 0 62-9.5t58-29.5q27 20 57.5 29.5T600-121q32 0 62-9.5t58-29.5q28 20 58 30t62 10h40v80h-40q-31 0-61-7.5T720-70q-29 15-59 22.5T600-40q-31 0-61-7.5T480-70q-29 15-59 22.5T360-40q-31 0-61-7.5T240-70q-29 15-59 22.5T120-40H80Zm280-460Zm244 0Z" />
      </svg>
    ),
  },
  {
    key: "birukbilugTracking",
    label: "BirukBilug Tracking",
    to: (role) => `/${role}/birukbilugTracking`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="white"
      >
        <path d="M480-80q-106 0-173-33.5T240-200q0-24 14.5-44.5T295-280l63 59q-9 4-19.5 9T322-200q13 16 60 28t98 12q51 0 98.5-12t60.5-28q-7-8-18-13t-21-9l62-60q28 16 43 36.5t15 45.5q0 53-67 86.5T480-80Zm1-220q99-73 149-146.5T680-594q0-102-65-154t-135-52q-70 0-135 52t-65 154q0 67 49 139.5T481-300Zm-1 100Q339-304 269.5-402T200-594q0-71 25.5-124.5T291-808q40-36 90-54t99-18q49 0 99 18t90 54q40 36 65.5 89.5T760-594q0 94-69.5 192T480-200Zm0-320q33 0 56.5-23.5T560-600q0-33-23.5-56.5T480-680q-33 0-56.5 23.5T400-600q0 33 23.5 56.5T480-520Zm0-80Z" />
      </svg>
    ),
  },

  {
    key: "userManagement",
    label: "User Management",
    to: (role) => `/${role}/userManagement`,
    show: ["admin"],
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="100px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#1f1f1f"
      >
        <path d="M560-680v-80h320v80H560Zm0 160v-80h320v80H560Zm0 160v-80h320v80H560Zm-240-40q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-160v-76q0-21 10-40t28-30q45-27 95.5-40.5T320-360q56 0 106.5 13.5T522-306q18 11 28 30t10 40v76H80Zm86-80h308q-35-20-74-30t-80-10q-41 0-80 10t-74 30Zm154-240q17 0 28.5-11.5T360-520q0-17-11.5-28.5T320-560q-17 0-28.5 11.5T280-520q0 17 11.5 28.5T320-480Zm0-40Zm0 280Z" />
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    to: (role) => `/${role}/notifications`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
        <path d="M480-120q-33 0-56.5-23.5T400-200h160q0 33-23.5 56.5T480-120Zm240-160H240v-360q0-83 56.5-141.5T440-820v-20q0-17 11.5-28.5T480-880q17 0 28.5 11.5T520-840v20q87 0 143.5 58.5T720-620v340Z"/>
      </svg>
    ),
  },
  {
    key: "reportGeneration",
    label: "Report Generation",
    to: (role) => `/${role}/reportGeneration`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="white"
      >
        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z" />
      </svg>
    ),
  },
  {
    key: "utility",
    label: "Utility",
    to: (role) => `/${role}/utility`,
    show: ["admin", "provincial_agriculturist", "municipal_agriculturist"],
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 0 24 24"
        width="24px"
        fill="white"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
      </svg>
    ),
  },
];

// Function to find active menu item recursively
const findActiveMenuItem = (items, pathname, role) => {
  let bestMatch = null;
  let longestMatch = 0;

  const searchItems = (itemList) => {
    for (const item of itemList) {
      // Check children first (for nested matches)
      if (item.children) {
        searchItems(item.children);
      }

      // Check if this item matches and has a 'to' function
      if (item.to && typeof item.to === "function" && item.show.includes(role)) {
        const itemPath = item.to(role);
        
        // Exact match or starts with the item path (with trailing slash)
        if (pathname === itemPath || pathname.startsWith(itemPath + '/')) {
          // Prefer longer matches (more specific routes)
          if (itemPath.length > longestMatch) {
            longestMatch = itemPath.length;
            bestMatch = item.key;
          }
        }
        // Special handling for route families (e.g., fisherfolkManagement should match /admin/fisherfolk/*)
        else if (item.key === 'fisherfolkManagement' && pathname.includes('/fisherfolk')) {
          const pathLength = itemPath.length;
          if (pathLength > longestMatch) {            
            longestMatch = pathLength;
            bestMatch = item.key;
          }
        }
        // Special handling for boat registry routes
        else if (item.key === 'boatRegistryManagement' && pathname.includes('/boat-registry')) {
          const pathLength = itemPath.length;
          if (pathLength > longestMatch) {
            longestMatch = pathLength;
            bestMatch = item.key;
          }
        }
        // Special handling for user management routes
        else if (item.key === 'userManagement' && pathname.includes('/users')) {
          const pathLength = itemPath.length;
          if (pathLength > longestMatch) {
            longestMatch = pathLength;
            bestMatch = item.key;
          }
        }
        // Special handling for BirukBilug Tracking and its related TrackerManagement routes
        else if (item.key === 'birukbilugTracking' && pathname.includes('/TrackerManagement')) {
          const pathLength = itemPath.length;
          if (pathLength > longestMatch) {
            longestMatch = pathLength;
            bestMatch = item.key;
          }
        }
        // Special handling for Utility and its related sub-pages
        else if (item.key === 'utility' && (
          pathname.includes('/backupRestore') ||
          pathname.includes('/boundaryEditor') ||
          pathname.includes('/excelImport') ||
          pathname.includes('/boatExcelImport') ||
          pathname.includes('/fisherfolkExcelImport') ||
          pathname.includes('/helpCenter') ||
          pathname.includes('/utility/activityLog') ||
          pathname.includes('/activityLogRep') ||
          pathname.includes('/municipalManagement') ||
          pathname.includes('/barangayVerifierManagement') ||
          pathname.includes('/signatories')
        )) {
          const pathLength = itemPath.length;
          if (pathLength > longestMatch) {
            longestMatch = pathLength;
            bestMatch = item.key;
          }
        }
      }
    }
  };

  searchItems(items);
  return bestMatch || "dashboard";
};

const Sidebar = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const role = user?.user_role?.toLowerCase();

  const [activeKey, setActiveKey] = useState(() => {
    if (!user || !role) return "dashboard";
    return findActiveMenuItem(menuItems, location.pathname, role);
  });

  const [openMenus, setOpenMenus] = useState({});

  // Update activeKey when location changes
  useEffect(() => {
    if (!user || !role) return;
    const newActiveKey = findActiveMenuItem(menuItems, location.pathname, role);
    setActiveKey(newActiveKey);
    localStorage.setItem("sidebarActiveKey", newActiveKey);
  }, [location.pathname, role, user]);

  useEffect(() => {
    if (!user) return;

    const openKeys = {};
    const findActive = (items) => {
      for (const item of items) {
        if (item.children) {
          const childActive = findActive(item.children);
          if (childActive) {
            openKeys[item.key] = true;
            return true;
          }
        }
        if (item.key === activeKey) return true;
      }
      return false;
    };
    findActive(menuItems);
    setOpenMenus(openKeys);
  }, [activeKey, user]);

  if (!user) return null;

  const handleClick = (key) => {
    setActiveKey(key);
    localStorage.setItem("sidebarActiveKey", key);
  };

  const handleMenuClick = (key, hasChildren) => {
    if (hasChildren) {
      setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      handleClick(key);
    }
  };

  const renderMenuItems = (items) =>
    items
      .filter((item) => item.show.includes(role))
      .map((item) => (
        <li key={item.key}>
          {item.children ? (
            <>
              <div
                className={`flex items-center gap-3 p-2 rounded-lg transition cursor-pointer ${
                  activeKey === item.key ? "bg-blue-700" : "hover:bg-blue-800"
                }`}
                onClick={() => handleMenuClick(item.key, true)}
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto">
                  {openMenus[item.key] ? (
                    <FaChevronDown size={14} />
                  ) : (
                    <FaChevronRight size={14} />
                  )}
                </span>
              </div>

              {openMenus[item.key] && (
                <ul className="ml-8 mt-1 space-y-1">
                  {renderMenuItems(item.children)}
                </ul>
              )}
            </>
          ) : (
            <Link
              to={item.to(role)}
              className={`flex items-center gap-3 p-2 rounded-lg transition ${
                activeKey === item.key
                  ? "bg-white text-blue-700 font-semibold"
                  : "hover:bg-blue-800 text-white"
              }`}
              onClick={() => handleClick(item.key)}
            >
              {item.icon &&
                React.cloneElement(item.icon, {
                  className: `w-4 h-4 transition ${
                    activeKey === item.key ? "fill-blue-700" : "fill-white"
                  }`,
                })}
              <span className="truncate">{item.label}</span>
              {item.key === 'notifications' && unreadCount > 0 && (
                <span
                  className="ml-auto inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold h-5 min-w-[20px] px-1.5"
                  aria-label={`${unreadCount} unread notifications`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}
        </li>
      ));

  return (
    <aside
      className="fixed top-20 left-0 w-79 h-[calc(100vh-3.75rem)] text-white z-10 font-montserrat"
      style={{
        backgroundColor: "#3863CF",
        fontFamily: "Montserrat, sans-serif",
      }}
    >
      <nav
        className="flex-1 px-4 py-3 font-montserrat"
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <ul className="space-y-2">{renderMenuItems(menuItems)}</ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
