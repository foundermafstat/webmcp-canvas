"use client";

import dynamic from "next/dynamic";
import type { ChartObject } from "@/domain/types";

const EChartView = dynamic(() => import("./EChart"), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-label="Loading chart" />,
});

export function ChartObjectView({ object }: { object: ChartObject }) {
  return (
    <>
      <EChartView object={object} />
      <table className="sr-only">
        <caption>{object.properties.title}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Sales</th>
          </tr>
        </thead>
        <tbody>
          {object.properties.categories.map((category, index) => (
            <tr key={`${category}-${index}`}>
              <th scope="row">{category}</th>
              <td>{object.properties.values[index]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
