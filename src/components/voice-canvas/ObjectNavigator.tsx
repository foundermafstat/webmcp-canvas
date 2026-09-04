"use client";

import { useMemo, useState } from "react";
import type { SceneObject } from "@/domain/types";
import { Icon } from "./Icons";

type ObjectNavigatorProps = {
  objects: SceneObject[];
  selectedObjectId: string;
  zoom: number;
  onSelect(objectId: string): void;
  onToggleHidden(object: SceneObject): void;
  onToggleLocked(object: SceneObject): void;
  onZoomChange(zoom: number): void;
  onEnterCanvasOnly(): void;
};

const TYPE_ORDER: Record<SceneObject["type"], number> = { chart: 0, text: 1, annotation: 2, table: 3, freehand: 4 };

function typeLabel(type: SceneObject["type"]) {
  if (type === "text") return "Title";
  if (type === "freehand") return "Drawing";
  if (type === "table") return "Table";
  return type[0].toUpperCase() + type.slice(1);
}

function typeIcon(type: SceneObject["type"]) {
  if (type === "text") return "text" as const;
  if (type === "freehand") return "pen" as const;
  if (type === "table") return "table" as const;
  return type;
}

export function ObjectNavigator({
  objects,
  selectedObjectId,
  zoom,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onZoomChange,
  onEnterCanvasOnly,
}: ObjectNavigatorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const visibleObjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...objects]
      .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
      .filter((object) => !selectedOnly || object.id === selectedObjectId)
      .filter((object) => {
        if (!normalizedQuery) return true;
        const label = typeLabel(object.type).toLowerCase();
        return label.includes(normalizedQuery) || object.id.toLowerCase().includes(normalizedQuery);
      });
  }, [objects, query, selectedObjectId, selectedOnly]);

  return (
    <div className="objects-panel">
      <div className="objects-header">
        <h2>Objects</h2>
        <div className="objects-header-actions">
          <button
            type="button"
            aria-label={searchOpen ? "Close object search" : "Search objects"}
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Icon name="search" />
          </button>
          <button
            type="button"
            aria-label="Show only the selected object"
            aria-pressed={selectedOnly}
            className={selectedOnly ? "is-pressed" : ""}
            onClick={() => setSelectedOnly((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h10M18 18h2" />
              <circle cx="13" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="16" cy="18" r="2" />
            </svg>
          </button>
        </div>
      </div>
      {searchOpen ? (
        <label className="object-search">
          <span className="sr-only">Search objects</span>
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Find object" />
        </label>
      ) : null}
      <ul className="object-list" aria-label="Canvas objects">
        {visibleObjects.map((object) => {
          const selected = object.id === selectedObjectId;
          return (
            <li key={object.id} className={selected ? "is-selected" : ""}>
              <button
                className="object-main"
                type="button"
                onClick={() => onSelect(object.id)}
                aria-current={selected ? "true" : undefined}
              >
                <Icon name={typeIcon(object.type)} />
                <span>{typeLabel(object.type)}</span>
              </button>
              <button
                className="object-action"
                type="button"
                aria-label={`${object.hidden ? "Show" : "Hide"} ${typeLabel(object.type)}`}
                aria-pressed={object.hidden}
                onClick={() => onToggleHidden(object)}
              >
                <Icon name={object.hidden ? "eyeOff" : "eye"} />
              </button>
              <button
                className="object-action"
                type="button"
                aria-label={`${object.locked ? "Unlock" : "Lock"} ${typeLabel(object.type)}`}
                aria-pressed={object.locked}
                onClick={() => onToggleLocked(object)}
              >
                <Icon name={object.locked ? "lock" : "unlock"} />
              </button>
            </li>
          );
        })}
      </ul>
      {visibleObjects.length === 0 ? <p className="no-objects">No matching objects</p> : null}
      <div className="zoom-controls" aria-label="Canvas zoom controls">
        <button type="button" onClick={() => onZoomChange(Math.max(75, zoom - 25))} aria-label="Zoom out">
          −
        </button>
        <output aria-live="polite">{zoom}%</output>
        <button type="button" onClick={() => onZoomChange(Math.min(150, zoom + 25))} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={onEnterCanvasOnly} aria-label="Enter canvas-only view">
          <Icon name="fit" />
        </button>
      </div>
    </div>
  );
}
