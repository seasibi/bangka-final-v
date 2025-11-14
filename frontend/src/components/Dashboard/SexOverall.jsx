import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

const SexOverall = () => {
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
  }, [user]);

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

  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <Chart options={options} series={series} type="bar" height={350} />
      )}
    </div>
  );
};

export default SexOverall;