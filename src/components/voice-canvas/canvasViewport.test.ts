import { describe, expect, it } from "vitest";
import {
  DEFAULT_CANVAS_VIEWPORT,
  focusCanvasFrame,
  panCanvasViewport,
  zoomCanvasViewportAt,
} from "./canvasViewport";

describe("canvas viewport geometry", () => {
  it("clamps pan and zoom while keeping the pointer world position stable", () => {
    const zoomed = zoomCanvasViewportAt(DEFAULT_CANVAS_VIEWPORT, 200, { x: 300, y: 200 });
    expect(zoomed).toEqual({ zoom: 200, panX: -300, panY: -200 });
    expect(panCanvasViewport(zoomed, 40, -20)).toEqual({ zoom: 200, panX: -260, panY: -220 });
    expect(zoomCanvasViewportAt(DEFAULT_CANVAS_VIEWPORT, 1, { x: 0, y: 0 }).zoom).toBe(25);
  });

  it("centers and fits an exact object without exceeding zoom bounds", () => {
    const focused = focusCanvasFrame(
      DEFAULT_CANVAS_VIEWPORT,
      { x: 400, y: 300, width: 400, height: 200 },
      { width: 1_000, height: 700 },
      true,
    );
    expect(focused.zoom).toBeGreaterThan(100);
    const scale = focused.zoom / 100;
    expect(focused.panX + 600 * scale).toBeCloseTo(500);
    expect(focused.panY + 400 * scale).toBeCloseTo(350);
  });
});
