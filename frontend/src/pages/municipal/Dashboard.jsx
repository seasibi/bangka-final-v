import React, { useEffect, useState } from "react";
import PageTitle from "../../components/PageTitle";
import { FaUserFriends, FaShip } from "react-icons/fa";
import { getDashboardStats, getMunicipalityDashboardStats } from "../../services/dashboardService";
import SexOverall from "../../components/Dashboard/SexOverall";
import MainSourceIncome from "../../components/Dashboard/MainSourceIncome";
import Boat_Municipality from "../../components/Dashboard/Boat_Municipality";
import ViolationsByMunicipality from "../../components/Dashboard/ViolationsByMunicipality";
import Loader from "../../components/Loader";
import BoatTypesChart from "../../components/Dashboard/BoatTypesChart";
import LivelihoodBreakdownChart from "../../components/Dashboard/LivelihoodBreakdownChart";

import { useAuth } from "../../contexts/AuthContext";

const StatCard = ({ icon: Icon, title, value, change, gradient }) => (
  <div className={`flex items-center justify-between p-5 rounded-2xl shadow-lg text-white transform transition-all hover:-translate-y-1 hover:shadow-2xl ${gradient}`}>
    <div>
      <p className="text-sm font-semibold opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {change !== undefined && (
        <p className={`mt-1 text-sm font-medium ${change >= 0 ? "text-green-200" : "text-red-200"}`}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
        </p>
      )}
    </div>
    <div className="p-3 bg-white bg-opacity-20 rounded-full">
      {Icon ? (
        <Icon className="w-6 h-6 text-[#3863CF]" aria-hidden="true" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#3863CF"><path d="m120-420 320-460v460H120Zm153-80h87v-125l-87 125Zm227 80q12-28 26-98t14-142q0-72-13.5-148T500-920q61 18 121.5 67t109 117q48.5 68 79 149.5T840-420H500Zm104-80h148q-17-77-55.5-141T615-750q2 21 3.5 43.5T620-660q0 47-4.5 87T604-500ZM360-200q-36 0-67-17t-53-43q-14 15-30.5 28T173-211q-35-26-59.5-64.5T80-360h800q-9 46-33.5 84.5T787-211q-20-8-36.5-21T720-260q-23 26-53.5 43T600-200q-36 0-67-17t-53-43q-22 26-53 43t-67 17ZM80-40v-80h40q32 0 62.5-10t57.5-30q27 20 57.5 29.5T360-121q32 0 62-9.5t58-29.5q27 20 57.5 29.5T600-121q32 0 62-9.5t58-29.5q28 20 58 30t62 10h40v80h-40q-31 0-61-7.5T720-70q-29 15-59 22.5T600-40q-31 0-61-7.5T480-70q-29 15-59 22.5T360-40q-31 0-61-7.5T240-70q-29 15-59 22.5T120-40H80Zm280-460Zm244 0Z"/></svg>
      )}
    </div>
  </div>
);

const QuickStat = ({ label, value, color }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-gray-600 font-medium">{label}</span>
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color}`}></span>
      <span className="font-semibold">{value}%</span>
    </div>
  </div>
);

const MunicipalDashboard = () => {
  const [stats, setStats] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get user from AuthContext
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        let statsData;
        if (user?.user_role === "municipal_agriculturist" && user?.municipality) {
          statsData = await getMunicipalityDashboardStats(user.municipality, startDate, endDate);
        } else {
          statsData = await getDashboardStats(startDate, endDate);
        }
        setStats(statsData);
        setError(null);
      } catch (err) {
        setError("Failed to load dashboard data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [startDate, endDate, user]);

  if (loading) return <LoaderFullScreen />;
  if (error) return <ErrorFullScreen message={error} />;

  return (
    <div className="h-full bg-gray-50">
      <div className="h-full px-4 py-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
        <div className="flex justify-between items-center ml-2">
        <div className="grid grid-cols-1 grid-rows-1">
          <h1 className="text-3xl font-bold text-gray-900 mt-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            DASHBOARD
          </h1>
          <p className="text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Overview and quick statistics
          </p>
        </div>
        
          <div className="grid grid-cols-1 grid-rows-1 mt-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">Date Range:</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {startDate && endDate
              ? `Showing data from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
              : "Showing all available data"}
          </p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mt-5">
        <StatCard
          icon={FaUserFriends}
          title="Active Fisherfolk"
          value={stats?.fisherfolk.active || 0}
          change={stats?.fisherfolk.change || 0}
            gradient="bg-gradient-to-r from-blue-400 to-blue-500"
        />
        <StatCard
          icon={FaShip}
          title="Active Boats"
          value={stats?.boats.active || 0}
          change={stats?.boats.change || 0}
            gradient="bg-gradient-to-r from-blue-400 to-blue-500"
        />
        <StatCard
          icon={FaUserFriends}
          title="Total Fisherfolk"
          value={stats?.fisherfolk.total || 0}
            gradient="bg-gradient-to-r from-blue-400 to-blue-500"
        />
        <StatCard
          icon={FaShip}
          title="Total Boats"
          value={stats?.boats.total || 0}
            gradient="bg-gradient-to-r from-blue-400 to-blue-500"
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 flex-none">
        <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col justify-center transform transition-all hover:-translate-y-1 hover:shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sex Distribution</h3>
          <p className="text-sm text-gray-600 mb-2">Fisherfolk registered by sex</p>
          <SexOverall startDate={startDate} endDate={endDate} />
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col justify-center transform transition-all hover:-translate-y-1 hover:shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Livelihood Breakdown</h3>
          <p className="text-sm text-gray-600 mb-2">Distribution by livelihood categories</p>
          <LivelihoodBreakdownChart />
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col justify-center transform transition-all hover:-translate-y-1 hover:shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Violations by Municipality</h3>
          <p className="text-sm text-gray-600 mb-2">Reported violations across municipalities</p>
          <ViolationsByMunicipality startDate={startDate} endDate={endDate} />
        </div>
      </div>
    </div>
    </div>
  );
}

const LoaderFullScreen = () => (
  <div className="h-screen flex items-center justify-center bg-gray-50">
    <Loader />
  </div>
);

const ErrorFullScreen = ({ message }) => (
  <div className="h-screen flex items-center justify-center bg-gray-50">
    <p className="text-red-600 font-medium">{message}</p>
  </div>
);
export default MunicipalDashboard