import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";

const TrackerDonutStat = ({ startDate, endDate }) => {
  const [series, setSeries] = useState([0, 0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrackers = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:8000/api/birukbilug/");
        let trackers = response.data || [];
        // Filter by date range if provided
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          trackers = trackers.filter((t) => {
            const createdDate = new Date(t.date_added || t.created_at);
            return createdDate >= start && createdDate <= end;
          });
        }
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
  }, [startDate, endDate]);

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

  const total = (series?.[0] || 0) + (series?.[1] || 0);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col items-center justify-center flex-1">
        {loading ? (
          <div className="text-center text-gray-500 text-sm">Loading...</div>
        ) : total === 0 ? (
          <div className="text-center text-gray-500 text-sm">No tracker data for the selected date range.</div>
        ) : (
          <Chart options={options} series={series} type="donut" height={250} />
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 text-center">Total trackers in range: {total}</p>
    </div>
  );
};

export default TrackerDonutStat;
