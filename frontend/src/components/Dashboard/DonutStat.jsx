import React from "react";
import Chart from "react-apexcharts";

const DonutStat = ({ title, active, inactive, labels = ["Active", "Inactive"], colors = ["#2563eb", "#93c5fd"] }) => {
  const series = [active, inactive];
  const options = {
    chart: { type: "donut" },
    labels: labels,
    colors: colors,
    legend: { position: "bottom" },
    title: { text: title },
    dataLabels: { enabled: true },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () => active + inactive,
            },
          },
        },
      },
    },
  };
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex flex-col items-center justify-center flex-1">
        <Chart options={options} series={series} type="donut" height={250} />
      </div>
    </div>
  );
};

export default DonutStat;
