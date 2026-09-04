import { describe, expect, it } from "vitest";
import {
  CANVAS_VIEW_STORAGE_KEY,
  persistCanvasViewMode,
  readCanvasViewMode,
} from "./canvasViewPreference";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("canvas view preference", () => {
  it("persists only canvas-only and explicitly clears it for standard view", () => {
    const storage = makeStorage();
    const root = { dataset: {} as DOMStringMap };

    persistCanvasViewMode("canvas_only", storage, root);
    expect(storage.getItem(CANVAS_VIEW_STORAGE_KEY)).toBe("canvas_only");
    expect(root.dataset.canvasView).toBe("canvas_only");
    expect(readCanvasViewMode(storage)).toBe("canvas_only");

    persistCanvasViewMode("standard", storage, root);
    expect(storage.getItem(CANVAS_VIEW_STORAGE_KEY)).toBeNull();
    expect(root.dataset.canvasView).toBeUndefined();
    expect(readCanvasViewMode(storage)).toBe("standard");
  });
});
