import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";

const Sex_FS = () => {
  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:8000/api/fisherfolk/");
        let fisherfolkData = response.data;

        // If municipal agriculturist, filter by municipality
        if (user?.user_role === "municipal_agriculturist" && user?.municipality) {
          fisherfolkData = fisherfolkData.filter(
            (person) => person.address?.municipality === user.municipality
          );
        }

        // Get unique main_source_livelihood values
        const allLivelihoods = fisherfolkData.map((person) => person.main_source_livelihood);
        const uniqueLivelihoods = Array.from(new Set(allLivelihoods)).filter(Boolean);

        // Count males and females per main_source_livelihood
        const maleCounts = uniqueLivelihoods.map(
          (livelihood) =>
            fisherfolkData.filter(
              (person) =>
                person.main_source_livelihood === livelihood &&
                person.sex &&
                person.sex.toLowerCase() === "male"
            ).length
        );
        const femaleCounts = uniqueLivelihoods.map(
          (livelihood) =>
            fisherfolkData.filter(
              (person) =>
                person.main_source_livelihood === livelihood &&
                person.sex &&
                person.sex.toLowerCase() === "female"
            ).length
        );

        setCategories(uniqueLivelihoods);
        setSeries([
          { name: "Males", data: maleCounts.map((v) => -v) },
          { name: "Females", data: femaleCounts },
        ]);
      } catch (err) {
        console.error("[Sex_FS] Error fetching fisherfolk data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Calculate max value for axis range (handle negatives for males)
  const allCounts = [...(series[0]?.data || []), ...(series[1]?.data || [])];
  const maxAbsValue = allCounts.length ? Math.max(...allCounts.map((v) => Math.abs(v))) : 0;
  const minX = maxAbsValue < 5 ? -5 : -maxAbsValue;
  const maxX = maxAbsValue < 5 ? 5 : maxAbsValue;

  const options = {
    chart: {
      type: "bar",
      height: 400,
      stacked: true,
    },
    colors: ["#1d4ed8", "#FF4560"],
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "70%",
        borderRadius: 5,
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 1, colors: ["#fff"] },
    grid: {
      xaxis: { lines: { show: false } },
    },
    yaxis: {},
    xaxis: {
      categories: categories,
      title: { text: "Number of Fisherfolk" },
      labels: {
        formatter: (val) => Math.round(val),
      },
      min: minX,
      max: maxX,
    },
    tooltip: {
      shared: false,
      x: { formatter: (val) => val },
      y: { formatter: (val) => Math.abs(val) + " fisherfolk" },
    },
    title:{},
  };

  useEffect(() => {
    console.log('[Sex_FS] Render: loading=', loading, 'categories=', categories, 'series=', series);
  }, [loading, categories, series]);

  return (
    <div className="flex flex-col items-center justify-center ">
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          
          <Chart options={options} series={series} type="bar" height={350} />
        </>
      )}
    </div>
  );
};

export default Sex_FS;