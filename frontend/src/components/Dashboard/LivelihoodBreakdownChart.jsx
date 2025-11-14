import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { useAuth } from "../../contexts/AuthContext";
import axios from "axios";

const LivelihoodBreakdownChart = () => {
  const [series, setSeries] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:8000/api/fisherfolk/");
        let fisherfolk = response.data;
        if (user?.user_role === "municipal_agriculturist" && user?.municipality) {
          fisherfolk = fisherfolk.filter(f => f.address?.municipality === user.municipality);
        }
        const allLivelihoods = fisherfolk.map(f => f.main_source_livelihood).filter(Boolean);
        const uniqueLivelihoods = Array.from(new Set(allLivelihoods));
        const livelihoodCounts = uniqueLivelihoods.map(l => fisherfolk.filter(f => f.main_source_livelihood === l).length);
        setLabels(uniqueLivelihoods);
        setSeries(livelihoodCounts);
      } catch {
        setLabels([]);
        setSeries([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const blueShades = [
    "#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#0ea5e9", "#0284c7", "#0369a1"
  ];
  const options = {
    chart: { type: "pie" },
    labels: labels,
    colors: blueShades,
    legend: { position: "bottom" },
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col items-center justify-center flex-1">
        {loading ? (
          <div>Loading...</div>
        ) : (
          <Chart options={options} series={series} type="pie" height={300} />
        )}
      </div>
    </div>
  );
};

export default LivelihoodBreakdownChart;
