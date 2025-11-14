import React, { useEffect, useState } from "react";
import axios from "axios";

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
};

const ViolationsByMunicipality = ({ startDate, endDate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchViolations = async () => {
      try {
        setLoading(true);
        const token = getCookie("access_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/boundary-notifications/`,
          { headers, withCredentials: true }
        );

        // Process violations by municipality
        let violations = response.data;

        // Filter by date range if provided
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          violations = violations.filter((v) => {
            const vDate = new Date(v.violation_timestamp);
            return vDate >= start && vDate <= end;
          });
        }

        // Normalize municipality names to handle aliases
        const normalizeMunicipality = (name) => {
          if (!name) return "Unknown";
          const normalized = name.toLowerCase().trim();
          // Handle San Fernando aliases
          if (normalized === "san fernando" || normalized === "city of san fernando") {
            return "San Fernando";
          }
          // Handle Sto. Tomas aliases
          if (normalized === "santo tomas" || normalized === "sto. tomas") {
            return "Santo Tomas";
          }
          // Capitalize first letter of each word
          return name
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
        };

        // Count by boat's home municipality (from_municipality is where the boat is registered)
        const violationCounts = {};
        violations.forEach((v) => {
          // Use from_municipality as the boat's home municipality
          const municipality = normalizeMunicipality(v.from_municipality);
          violationCounts[municipality] = (violationCounts[municipality] || 0) + 1;
        });
        
        console.log("Violation counts by home municipality:", violationCounts);

        // Sort by count descending
        const sorted = Object.entries(violationCounts)
          .map(([municipality, count]) => ({ municipality, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3); // Top 3

        setData(sorted);
      } catch (error) {
        console.error("Error fetching violations:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchViolations();
  }, [startDate, endDate]);

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="text-center text-gray-500">No violations data</div>;
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Violations by Municipality</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.municipality}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{item.municipality}</span>
              <span className="text-sm font-semibold text-blue-600">{item.count}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="bg-gradient-to-r from-red-500 to-red-600 h-6 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  minWidth: item.count > 0 ? "10%" : "0%",
                }}
              >
                {item.count > 0 && (
                  <span className="text-xs font-bold text-white">{item.count}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ViolationsByMunicipality;
