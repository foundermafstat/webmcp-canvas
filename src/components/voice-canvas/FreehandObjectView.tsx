"use client";

import type { FreehandObject, FreehandPoint } from "@/domain/types";

const STROKES = {
  coral: "#ff5a45",
  ink: "#202020",
} as const;

function midpoint(a: FreehandPoint, b: FreehandPoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function closedSmoothPath(points: FreehandPoint[]) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return "";
  const start = midpoint(last, first);
  const segments = points.map((point, index) => {
    const next = points[(index + 1) % points.length] ?? first;
    const end = midpoint(point, next);
    return `Q ${point.x} ${point.y} ${end.x} ${end.y}`;
  });
  return `M ${start.x} ${start.y} ${segments.join(" ")} Z`;
}

function intrinsicExtent(points: FreehandPoint[], axis: "x" | "y") {
  const values = points.map((point) => point[axis]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return Math.max(1, maximum + Math.max(0, minimum));
}

export function FreehandObjectView({ object, animate = false }: { object: FreehandObject; animate?: boolean }) {
  const sourceWidth = object.properties.sourceWidth ?? intrinsicExtent(object.properties.points, "x");
  const sourceHeight = object.properties.sourceHeight ?? intrinsicExtent(object.properties.points, "y");

  return (
    <svg
      className="freehand-renderer"
      viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className={`freehand-stroke stroke-${object.properties.strokeToken}${animate ? " is-drawing" : ""}`}
        pathLength={1}
        d={closedSmoothPath(object.properties.points)}
        fill="none"
        stroke={STROKES[object.properties.strokeToken]}
        strokeWidth={object.properties.strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
