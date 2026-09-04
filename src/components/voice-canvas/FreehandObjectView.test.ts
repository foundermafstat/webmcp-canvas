import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AGENT_ACTOR, type FreehandObject } from "@/domain/types";
import { FreehandObjectView } from "./FreehandObjectView";

const object: FreehandObject = {
  id: "obj_test_drawing",
  type: "freehand",
  parentId: null,
  zIndex: "0001",
  frame: { x: 100, y: 100, width: 100, height: 100 },
  hidden: false,
  locked: false,
  properties: {
    label: "Circle",
    points: [
      { x: 50, y: 5 }, { x: 82, y: 18 }, { x: 95, y: 50 }, { x: 82, y: 82 },
      { x: 50, y: 95 }, { x: 18, y: 82 }, { x: 5, y: 50 }, { x: 18, y: 18 },
    ],
    strokeToken: "coral",
    strokeWidth: 5,
    closed: true,
  },
  createdBy: AGENT_ACTOR,
  updatedBy: AGENT_ACTOR,
  provenance: { source: "tool", operationId: "op-test-drawing", toolName: "add_freehand" },
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-04T10:00:00.000Z",
  lastOperationId: "op-test-drawing",
};

describe("FreehandObjectView", () => {
  it("marks only an explicitly new stroke for progressive drawing", () => {
    const animated = renderToStaticMarkup(createElement(FreehandObjectView, { object, animate: true }));
    const restored = renderToStaticMarkup(createElement(FreehandObjectView, { object }));

    expect(animated).toContain('class="freehand-stroke stroke-coral is-drawing"');
    expect(animated).toContain('pathLength="1"');
    expect(restored).toContain('class="freehand-stroke stroke-coral"');
    expect(restored).not.toContain("is-drawing");
  });

  it("keeps a stable intrinsic viewBox while the object frame becomes an oval", () => {
    const stretched = renderToStaticMarkup(
      createElement(FreehandObjectView, {
        object: { ...object, frame: { ...object.frame, width: 180, height: 70 } },
      }),
    );

    expect(stretched).toContain('viewBox="0 0 100 100"');
    expect(stretched).toContain('preserveAspectRatio="none"');
  });
});
