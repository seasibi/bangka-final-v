import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { useAuth } from "../../contexts/AuthContext";
import axios from "axios";

const BoatTypesChart = () => {
  const [series, setSeries] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:8000/api/boats/");
        let boats = response.data;
        if (user?.user_role === "municipal_agriculturist" && user?.municipality) {
          boats = boats.filter(b => b.fisherfolk?.address?.municipality === user.municipality);
        }
        const allTypes = boats.map(b => b.boat_type).filter(Boolean);
        const uniqueTypes = Array.from(new Set(allTypes));
        const typeCounts = uniqueTypes.map(type => boats.filter(b => b.boat_type === type).length);
        setLabels(uniqueTypes);
        setSeries(typeCounts);
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

export default BoatTypesChart;
