import { describe, expect, it } from "vitest";
import { moveTableFrame, resizeTableFrame, sameFrame } from "./tableResize";

describe("table resize geometry", () => {
  const start = { x: 100, y: 80, width: 460, height: 320 };
  const viewport = { width: 900, height: 700 };

  it("resizes from every edge while preserving safe minimums", () => {
    expect(resizeTableFrame(start, "e", -120, 0, viewport)).toEqual({ x: 100, y: 80, width: 340, height: 320 });
    expect(resizeTableFrame(start, "s", 0, -140, viewport)).toEqual({ x: 100, y: 80, width: 460, height: 180 });
    expect(resizeTableFrame(start, "nw", 400, 400, viewport)).toEqual({ x: 320, y: 280, width: 240, height: 120 });
  });

  it("never produces a frame outside the viewport or size bounds", () => {
    const frame = resizeTableFrame(start, "se", 10_000, 10_000, viewport);
    expect(frame).toEqual({ x: 100, y: 80, width: 800, height: 620 });
    expect(sameFrame(frame, start)).toBe(false);
  });

  it("moves without changing size and clamps the table inside the viewport", () => {
    expect(moveTableFrame(start, 90, -200, viewport)).toEqual({ x: 190, y: 0, width: 460, height: 320 });
    expect(moveTableFrame(start, 10_000, 10_000, viewport)).toEqual({ x: 440, y: 380, width: 460, height: 320 });
  });
});
