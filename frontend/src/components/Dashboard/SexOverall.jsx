import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

const SexOverall = ({ startDate, endDate }) => {

  const [series, setSeries] = useState([]); // single series with counts
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ males: 0, females: 0 });
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

        const males = rows.filter((p) => (p.sex || "").toLowerCase() === "male").length;
        const females = rows.filter((p) => (p.sex || "").toLowerCase() === "female").length;
        setCounts({ males, females });
        setSeries([{ name: "Fisherfolk", data: [males, females] }]);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, startDate, endDate]);

  const options = {
    chart: { type: "bar", toolbar: { show: true } },
    colors: ["#2563eb", "#ef4444"],
    plotOptions: { bar: { horizontal: false, columnWidth: "45%", borderRadius: 6, distributed: true } },
    dataLabels: { enabled: false },
    xaxis: { categories: ["Males", "Females"], title: { text: undefined } },
    yaxis: { title: { text: "Count" } },
    legend: { show: false },
    grid: { yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
    tooltip: { y: { formatter: (val) => `${val} fisherfolk` } },
  };

  const hasData = series && series[0] && Array.isArray(series[0].data) && series[0].data.some((v) => v > 0);

  return (
    <div>
      {loading ? (
        <div className="text-center text-gray-500 text-sm">Loading...</div>
      ) : !hasData ? (
        <div className="text-center text-gray-500 text-sm">No fisherfolk data for the selected date range.</div>
      ) : (
        <Chart options={options} series={series} type="bar" height={350} />
      )}
    </div>
  );
};

export default SexOverall;