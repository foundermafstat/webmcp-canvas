import { describe, expect, it } from "vitest";
import { resizeRotatedFrame } from "./rotatedResize";

const bounds = { minWidth: 48, minHeight: 48, maxWidth: 1_000, maxHeight: 720 };

describe("resizeRotatedFrame", () => {
  it("resizes a quarter-turned object along its visual width axis", () => {
    const resized = resizeRotatedFrame(
      { x: 0, y: 0, width: 200, height: 100 },
      90,
      { horizontal: 1, vertical: 0 },
      0,
      -60,
      bounds,
    );

    expect(resized.width).toBeCloseTo(140);
    expect(resized.height).toBe(100);
    expect(resized.x).toBeCloseTo(30);
    expect(resized.y).toBeCloseTo(-30);
  });

  it("changes width and height independently for a rotated corner", () => {
    const resized = resizeRotatedFrame(
      { x: 40, y: 50, width: 180, height: 120 },
      45,
      { horizontal: 1, vertical: 1 },
      42.4264,
      14.1421,
      bounds,
    );

    expect(resized.width).toBeCloseTo(220, 3);
    expect(resized.height).toBeCloseTo(100, 3);
  });
});
