import React, { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { getBoats } from "../../services/boatService";

const Boat_Municipality = ({ startDate, endDate }) => {

  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {

    const fetchData = async () => {
      try {
        console.log('[Boat_Municipality] Fetching boats...');
        // 1. Get all boats
        const boatsList = await getBoats();
        console.log('[Boat_Municipality] boatsList:', boatsList);

        // Filter by date range if provided
        let filteredBoats = Array.isArray(boatsList) ? boatsList : [];
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filteredBoats = filteredBoats.filter((b) => {
            const createdDate = new Date(b.date_added || b.created_at);
            return createdDate >= start && createdDate <= end;
          });
        }

        // 2. Build records: { municipality (from boat.fisherfolk.address), boat_type }
        // Log all boat_type values for debugging
        filteredBoats.forEach(boat => {

          console.log('[Boat_Municipality] boat_type raw:', boat?.boat_type);
        });
        const records = filteredBoats.map(boat => {

          const municipality = boat?.fisherfolk?.address?.municipality;
          // Normalize boat_type for comparison
          const boat_type = typeof boat?.boat_type === 'string' ? boat.boat_type.trim().toLowerCase() : '';
          const record = { municipality, boat_type };
          return record;
        }).filter(r => r.municipality && r.boat_type);
        console.log('[Boat_Municipality] records:', records);

        // 4. Get unique municipalities
        const municipalities = Array.from(new Set(records.map(r => r.municipality)));
        console.log('[Boat_Municipality] municipalities:', municipalities);

        // 5. Count boats by type for each municipality
        const motorizedCounts = municipalities.map(m =>
          records.filter(
            r =>
              r.municipality === m &&
              r.boat_type === "motorized"
          ).length
        );
        const nonmotorizedCounts = municipalities.map(m =>
          records.filter(
            r =>
              r.municipality === m &&
              r.boat_type === "non-motorized"
          ).length
        );
        console.log('[Boat_Municipality] motorizedCounts:', motorizedCounts);
        console.log('[Boat_Municipality] nonmotorizedCounts:', nonmotorizedCounts);

        setCategories(municipalities);
        setSeries([
          { name: "Motorized", data: motorizedCounts },
          { name: "Non-Motorized", data: nonmotorizedCounts },
        ]);
        console.log('[Boat_Municipality] Chart categories:', municipalities);
        console.log('[Boat_Municipality] Chart series:', [
          { name: "Motorized", data: motorizedCounts },
          { name: "Non-Motorized", data: nonmotorizedCounts },
        ]);
      } catch (err) {
        console.error('[Boat_Municipality] Error:', err);
        setSeries([]);
        setCategories([]);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  // Calculate max value for y-axis range
  const allCounts = [...(series[0]?.data || []), ...(series[1]?.data || [])];
  const maxValue = allCounts.length ? Math.max(...allCounts) : 0;
  const minY = 0;
  const maxY = maxValue < 5 ? 5 : maxValue;

  const blueShades = ["#2563eb", "#60a5fa"];
  const options = {
    chart: {
      type: "bar",
      height: 350,
      stacked: false,
    },
    colors: blueShades,
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    xaxis: {
      categories: categories,
      title: { text: "Municipality" },
    },
    yaxis: {
      title: {
        text: "Number of Boats",
      },
      min: minY,
      max: maxY,
      labels: {
        formatter: (val) => Math.round(val),
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return Math.round(val) + " boats";
        },
      },
    },
  };

  useEffect(() => {
    console.log('[Boat_Municipality] Render: categories=', categories, 'series=', series);
  }, [categories, series]);

  const hasData =
    Array.isArray(series) &&
    series.length > 0 &&
    series.some((s) => Array.isArray(s.data) && s.data.some((v) => v > 0));

  return (
    <div className="space-y-2">
      {!hasData ? (
        <div className="text-center text-gray-500 text-sm">No boat registration data for the selected date range.</div>
      ) : (
        <ReactApexChart options={options} series={series} type="bar" height={350} />
      )}
      <p className="text-xs text-gray-500">Blue: Motorized • Light blue: Non-motorized</p>
    </div>
  );
};

export default Boat_Municipality;