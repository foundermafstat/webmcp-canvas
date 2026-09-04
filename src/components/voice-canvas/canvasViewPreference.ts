export type CanvasViewMode = "canvas_only" | "standard";

export const CANVAS_VIEW_STORAGE_KEY = "voice-canvas:view-mode";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RootLike = { dataset: DOMStringMap };

export function readCanvasViewMode(storage: Pick<StorageLike, "getItem">): CanvasViewMode {
  try {
    return storage.getItem(CANVAS_VIEW_STORAGE_KEY) === "canvas_only" ? "canvas_only" : "standard";
  } catch {
    return "standard";
  }
}

export function persistCanvasViewMode(mode: CanvasViewMode, storage: StorageLike | undefined, root: RootLike) {
  if (mode === "canvas_only") root.dataset.canvasView = "canvas_only";
  else delete root.dataset.canvasView;

  if (!storage) return;
  try {
    if (mode === "canvas_only") storage.setItem(CANVAS_VIEW_STORAGE_KEY, mode);
    else storage.removeItem(CANVAS_VIEW_STORAGE_KEY);
  } catch {
    // UI mode still changes when session storage is unavailable.
  }
}
