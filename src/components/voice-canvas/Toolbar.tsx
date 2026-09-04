"use client";

import { useState } from "react";
import { Icon, type IconName } from "./Icons";

type ToolItem = {
  icon: IconName;
  label: string;
  action?: "select" | "add-chart" | "add-freehand" | "fit" | "more";
};

const TOOLS: ToolItem[] = [
  { icon: "pointer", label: "Select", action: "select" },
  { icon: "shape", label: "Shapes — planned" },
  { icon: "text", label: "Text — planned" },
  { icon: "annotation", label: "Annotation — planned" },
  { icon: "chart", label: "Add chart", action: "add-chart" },
  { icon: "fit", label: "Fit selected object", action: "fit" },
  { icon: "pen", label: "Draw a circle", action: "add-freehand" },
  { icon: "image", label: "Media — planned" },
  { icon: "table", label: "Table — planned" },
  { icon: "more", label: "More tools", action: "more" },
];

type ToolbarProps = {
  hasChart: boolean;
  onAddChart(): void;
  onAddFreehand(): void;
  onSelectChart(): void;
};

export function Toolbar({ hasChart, onAddChart, onAddFreehand, onSelectChart }: ToolbarProps) {
  const [activeTool, setActiveTool] = useState("select");
  const [showMore, setShowMore] = useState(false);

  function activate(item: ToolItem) {
    if (item.action === "add-chart") {
      setActiveTool("chart");
      onAddChart();
      return;
    }
    if (item.action === "add-freehand") {
      setActiveTool("add-freehand");
      onAddFreehand();
      return;
    }
    if (item.action === "select") {
      setActiveTool("select");
      if (hasChart) onSelectChart();
      return;
    }
    if (item.action === "fit") {
      setActiveTool("select");
      if (hasChart) onSelectChart();
      return;
    }
    if (item.action === "more") setShowMore((value) => !value);
  }

  return (
    <nav className="tool-rail" aria-label="Canvas tools">
      {TOOLS.map((item, index) => {
        const disabled = !item.action;
        return (
          <button
            className={`tool-button ${item.action === activeTool ? "is-active" : ""}`}
            disabled={disabled}
            key={item.label}
            onClick={() => activate(item)}
            aria-label={item.label}
            aria-pressed={item.action ? activeTool === item.action : undefined}
            title={item.label}
          >
            <Icon name={item.icon} />
          </button>
        );
      })}
      {showMore ? (
        <div className="tool-popover" role="status">
          P0–P2 tools
        </div>
      ) : null}
    </nav>
  );
}
