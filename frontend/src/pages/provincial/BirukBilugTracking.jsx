import React from "react";
import PageTitle from "../../components/PageTitle";
import MapView from "../../maps/MapView";
import Button from "../../components/Button";
import { useNavigate } from "react-router-dom";

const PABirukBilugTracking = () => {
  const navigate = useNavigate();
  const [boundaryType, setBoundaryType] = React.useState("water");
  const [searchMfbr, setSearchMfbr] = React.useState("");
  return (
    <div className="h-full bg-gray-50" style={{ fontFamily: "Montserrat, sans-serif" }}>
      <div className="h-full px-4 py-7" style={{ fontFamily: "Montserrat, sans-serif" }}>
        {/* Page Title */}
        <div className="flex justify-between items-center">
<div className="grid grid-cols-1 grid-rows-2 ml-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              BIRUKBILUG TRACKING MANAGEMENT
            </h1>
            <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Manage BirukBilug tracking
            </p>
          </div>

          <div className="flex gap-3 items-center">
            {/* Search by MFBR */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by MFBR number..."
                value={searchMfbr}
                onChange={(e) => setSearchMfbr(e.target.value)}
                className="pl-10 pr-10 py-2.5 w-72 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              />
              {searchMfbr && (
                <button
                  onClick={() => setSearchMfbr("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-150"
                  aria-label="Clear search"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <Button
              onClick={() => navigate("/provincial_agriculturist/TrackerManagement")}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              style={{
                backgroundColor: "#3863CF",
                fontFamily: "Montserrat, sans-serif",
              }}
            >
              {" "}
              View Tracker List
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative w-full h-[50vh] sm:h-[60vh] md:h-[65vh] lg:h-[70vh] xl:h-[70vh] 2xl:h-[76vh] rounded-xl px-3 overflow-hidden shadow-lg">
          <MapView boundaryType={boundaryType} searchMfbr={searchMfbr}/>
        {/* Controls */}
          <div className="absolute top-4 right-4 z-20 bg-white/90 p-4 rounded-xl shadow-md w-64 space-y-3 pointer-events-auto">
            {/* Toggle Water/Land Boundaries */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300 mb-2">
              <button
                className={`flex-1 px-2 py-2 font-semibold text-sm transition-all duration-150 focus:outline-none ${boundaryType === "water" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-blue-100"}`}
                style={{ borderRight: "1px solid #e5e7eb" }}
                onClick={() => setBoundaryType("water")}
                aria-pressed={boundaryType === "water"}
              >
                Water Boundaries
              </button>
              <button
                className={`flex-1 px-2 py-2 font-semibold text-sm transition-all duration-150 focus:outline-none ${boundaryType === "land" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-blue-100"}`}
                onClick={() => setBoundaryType("land")}
                aria-pressed={boundaryType === "land"}
              >
                Land Boundaries
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PABirukBilugTracking;
