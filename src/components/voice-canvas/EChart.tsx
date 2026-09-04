"use client";

import { BarChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { init, use, type ECharts, type EChartsCoreOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import type { ChartObject } from "@/domain/types";

use([BarChart, GridComponent, SVGRenderer]);

const COLORS = {
  coral: "#ff5a45",
  ink: "#7fb3ff",
  green: "#42d18b",
};

function compileOption(object: ChartObject, width: number): EChartsCoreOption {
  const { categories, values, colorToken } = object.properties;
  const compact = width < 420;
  const maxValue = Math.max(...values, 10);
  const interval = maxValue <= 20 ? 5 : maxValue <= 60 ? 10 : 20;
  const yMax = Math.ceil(maxValue / interval) * interval + (maxValue % interval === 0 ? interval : 0);

  return {
    animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    grid: compact
      ? { left: 40, top: 18, right: 12, bottom: 34 }
      : { left: 54, top: 40, right: 18, bottom: 55 },
    xAxis: {
      type: "category",
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#626975", width: 1 } },
      axisLabel: { color: "#e7eaf0", fontSize: compact ? 10 : 14, margin: compact ? 8 : 12, interval: 0 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: yMax,
      splitNumber: 1,
      axisLabel: { color: "#cbd1db", fontSize: compact ? 10 : 13, margin: compact ? 8 : 12 },
      splitLine: { lineStyle: { color: "#343a44", type: "dashed" } },
    },
    series: [
      {
        type: "bar",
        data: values.map((value, index) => ({
          value,
          itemStyle: {
            color:
              colorToken === "duo"
                ? index % 2 === 0
                  ? COLORS.coral
                  : COLORS.ink
                : COLORS[colorToken],
            borderRadius: [2, 2, 0, 0],
          },
        })),
        barWidth: "34%",
        label: {
          show: true,
          position: "top",
          color: "#f2f4f8",
          fontSize: compact ? 10 : 12,
          fontWeight: 600,
        },
      },
    ],
  };
}

export default function EChartView({ object }: { object: ChartObject }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const chart: ECharts = init(hostRef.current, undefined, { renderer: "svg" });
    const render = () => {
      chart.resize();
      chart.setOption(compileOption(object, hostRef.current?.clientWidth ?? 570), true);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(hostRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [object]);

  return <div ref={hostRef} className="chart-renderer" role="img" aria-label={`${object.properties.title} bar chart`} />;
}
