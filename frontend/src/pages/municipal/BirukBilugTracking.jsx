import React from "react";
import PageTitle from "../../components/PageTitle";
import MapView from "../../maps/MapView";
import Button from "../../components/Button";
import { useNavigate } from "react-router-dom";

const MABirukBilugTracking = () => {
  const navigate = useNavigate();
  const [boundaryType, setBoundaryType] = React.useState("water");
  const [searchMfbr, setSearchMfbr] = React.useState("");
  return (
    <div className="h-full bg-gray-50" style={{ fontFamily: "Montserrat, sans-serif" }}>
      <div className="h-full px-4 py-7" style={{ fontFamily: "Montserrat, sans-serif" }}>
        {/* Page Title */}
         <div className="flex justify-between items-center ml-2">
          <div className="grid grid-cols-1 grid-rows-2">
            <h1 className="text-3xl font-bold text-gray-900 mt-3" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              BIRUKBILUG TRACKER MANAGEMENT
            </h1>
            <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Monitor the boats as they move. Manage the trackers as well.
            </p>
          </div>

          
          <Button
            onClick={() => navigate("/municipal_agriculturist/TrackerManagement")}
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
            <button className="w-full py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition">
              Filter Boats
            </button>
            <button className="w-full py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition">
              View Boundaries
            </button>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">Active Boats</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">Boundary</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MABirukBilugTracking;