import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";

const TrackerDonutStat = () => {
  const [series, setSeries] = useState([0, 0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrackers = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:8000/api/birukbilug/");
        const trackers = response.data || [];
        // Assume assigned if tracker.fisherfolk or tracker.boat is not null
        const assigned = trackers.filter(t => t.fisherfolk || t.boat).length;
        const unassigned = trackers.length - assigned;
        setSeries([assigned, unassigned]);
      } catch {
        setSeries([0, 0]);
      } finally {
        setLoading(false);
      }
    };
    fetchTrackers();
  }, []);

  const blueShades = [
    "#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#0ea5e9", "#0284c7", "#0369a1"
  ];
  const options = {
    chart: { type: "donut" },
    labels: ["Assigned", "Unassigned"],
    colors: blueShades.slice(0, 2),
    legend: { position: "bottom" },
    dataLabels: { enabled: true },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () => series[0] + series[1],
            },
          },
        },
      },
    },
    states: {
      hover: {
        filter: {
          type: 'lighten',
          value: 0.5,
        },
      },
      active: {
        filter: {
          type: 'darken',
          value: 0.5,
        },
      },
    },
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col items-center justify-center flex-1">
        {loading ? <div>Loading...</div> : <Chart options={options} series={series} type="donut" height={250} />}
      </div>
    </div>
  );
};

export default TrackerDonutStat;
