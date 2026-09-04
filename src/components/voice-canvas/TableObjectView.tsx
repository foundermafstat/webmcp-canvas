"use client";

import type { TableObject } from "@/domain/types";

export function TableObjectView({ object, movable = false }: { object: TableObject; movable?: boolean }) {
  return (
    <div className="table-renderer">
      <div className={`table-caption ${movable ? "table-drag-handle" : ""}`}>{object.properties.title}</div>
      <div className="table-scroll nodrag nopan nowheel">
        <table>
          <caption className="sr-only">{object.properties.title}</caption>
          <thead>
            <tr>
              {object.properties.columns.map((column, index) => (
                <th scope="col" key={`${index}-${column}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {object.properties.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
