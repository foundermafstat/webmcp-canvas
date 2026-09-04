import type { Frame } from "@/domain/types";

export type CanvasViewport = {
  zoom: number;
  panX: number;
  panY: number;
};

export type CanvasViewportUpdate =
  | CanvasViewport
  | ((current: CanvasViewport) => CanvasViewport);

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { zoom: 100, panX: 0, panY: 0 };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeCanvasViewport(viewport: CanvasViewport): CanvasViewport {
  return {
    zoom: clamp(Number.isFinite(viewport.zoom) ? viewport.zoom : 100, 25, 300),
    panX: clamp(Number.isFinite(viewport.panX) ? viewport.panX : 0, -10_000, 10_000),
    panY: clamp(Number.isFinite(viewport.panY) ? viewport.panY : 0, -10_000, 10_000),
  };
}

export function panCanvasViewport(viewport: CanvasViewport, deltaX: number, deltaY: number) {
  return normalizeCanvasViewport({
    ...viewport,
    panX: viewport.panX + deltaX,
    panY: viewport.panY + deltaY,
  });
}

export function zoomCanvasViewportAt(
  viewport: CanvasViewport,
  zoom: number,
  point: { x: number; y: number },
) {
  const nextZoom = clamp(zoom, 25, 300);
  const current = normalizeCanvasViewport(viewport);
  const ratio = nextZoom / current.zoom;
  return normalizeCanvasViewport({
    zoom: nextZoom,
    panX: point.x - (point.x - current.panX) * ratio,
    panY: point.y - (point.y - current.panY) * ratio,
  });
}

export function focusCanvasFrame(
  viewport: CanvasViewport,
  frame: Frame,
  canvas: { width: number; height: number },
  fit: boolean,
  requestedZoom?: number,
) {
  const padding = 64;
  const fittedZoom = Math.min(
    (Math.max(1, canvas.width - padding * 2) / frame.width) * 100,
    (Math.max(1, canvas.height - padding * 2) / frame.height) * 100,
  );
  const zoom = requestedZoom ?? (fit ? fittedZoom : viewport.zoom);
  const normalizedZoom = normalizeCanvasViewport({ ...viewport, zoom }).zoom;
  const scale = normalizedZoom / 100;
  return normalizeCanvasViewport({
    zoom: normalizedZoom,
    panX: canvas.width / 2 - (frame.x + frame.width / 2) * scale,
    panY: canvas.height / 2 - (frame.y + frame.height / 2) * scale,
  });
}
