import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

const MainSourceIncome = ({ startDate, endDate }) => {

  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {

    const fetchData = async () => {
      setLoading(true);
      try {
        const resp = await axios.get("http://localhost:8000/api/fisherfolk/");
        let rows = Array.isArray(resp.data) ? resp.data : [];
        if (user?.user_role === "municipal_agriculturist" && user?.municipality) {
          rows = rows.filter((p) => p.address?.municipality === user.municipality);
        }
        // Filter by date range if provided
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          rows = rows.filter((p) => {
            const createdDate = new Date(p.date_added || p.created_at);
            return createdDate >= start && createdDate <= end;
          });
        }

        const map = new Map();
        rows.forEach((p) => {
          const k = p.main_source_livelihood || "Unknown";
          map.set(k, (map.get(k) || 0) + 1);
        });
        const cats = Array.from(map.keys());
        const data = Array.from(map.values());
        setCategories(cats);
        setSeries([{ name: "Fisherfolk", data }]);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, startDate, endDate]);

  const options = {
    chart: { type: "bar" },
    colors: ["#3b82f6"],
    plotOptions: { bar: { horizontal: true, barHeight: "65%", borderRadius: 5 } },
    dataLabels: { enabled: false },
    xaxis: { categories, title: { text: "Number of Fisherfolk" } },
    yaxis: {},
    grid: { xaxis: { lines: { show: false } } },
    tooltip: { y: { formatter: (v) => `${v} fisherfolk` } },
    legend: { show: false },
  };

  const hasData = series && series[0] && Array.isArray(series[0].data) && series[0].data.some((v) => v > 0);

  return (
    <div>
      {loading ? (
        <div className="text-center text-gray-500 text-sm">Loading...</div>
      ) : !hasData ? (
        <div className="text-center text-gray-500 text-sm">No livelihood data for the selected date range.</div>
      ) : (
        <Chart options={options} series={series} type="bar" height={350} />
      )}
    </div>
  );
};

export default MainSourceIncome;