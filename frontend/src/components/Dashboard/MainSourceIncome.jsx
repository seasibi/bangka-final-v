import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

const MainSourceIncome = () => {
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
  }, [user]);

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

export default MainSourceIncome;