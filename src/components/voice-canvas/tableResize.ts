import type { Frame } from "@/domain/types";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const MIN_WIDTH = 240;
const MIN_HEIGHT = 120;
const MAX_WIDTH = 1_000;
const MAX_HEIGHT = 720;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function resizeTableFrame(
  start: Frame,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  viewport: { x?: number; y?: number; width: number; height: number },
): Frame {
  const safeViewportWidth = Math.max(MIN_WIDTH, Math.min(10_000, viewport.width));
  const safeViewportHeight = Math.max(MIN_HEIGHT, Math.min(10_000, viewport.height));
  const minX = Number.isFinite(viewport.x) ? viewport.x! : 0;
  const minY = Number.isFinite(viewport.y) ? viewport.y! : 0;
  const maxX = minX + safeViewportWidth;
  const maxY = minY + safeViewportHeight;
  let left = clamp(start.x, minX, maxX - MIN_WIDTH);
  let top = clamp(start.y, minY, maxY - MIN_HEIGHT);
  let right = clamp(start.x + start.width, left + MIN_WIDTH, Math.min(maxX, left + MAX_WIDTH));
  let bottom = clamp(start.y + start.height, top + MIN_HEIGHT, Math.min(maxY, top + MAX_HEIGHT));

  if (handle.includes("w")) left = clamp(left + deltaX, minX, right - MIN_WIDTH);
  if (handle.includes("e")) right = clamp(right + deltaX, left + MIN_WIDTH, Math.min(maxX, left + MAX_WIDTH));
  if (handle.includes("n")) top = clamp(top + deltaY, minY, bottom - MIN_HEIGHT);
  if (handle.includes("s")) bottom = clamp(bottom + deltaY, top + MIN_HEIGHT, Math.min(maxY, top + MAX_HEIGHT));

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

export function moveTableFrame(
  start: Frame,
  deltaX: number,
  deltaY: number,
  viewport: { x?: number; y?: number; width: number; height: number },
): Frame {
  const minX = Number.isFinite(viewport.x) ? viewport.x! : 0;
  const minY = Number.isFinite(viewport.y) ? viewport.y! : 0;
  const maxX = minX + Math.max(start.width, Math.min(10_000, viewport.width));
  const maxY = minY + Math.max(start.height, Math.min(10_000, viewport.height));
  return {
    ...start,
    x: Math.round(clamp(start.x + deltaX, minX, maxX - start.width)),
    y: Math.round(clamp(start.y + deltaY, minY, maxY - start.height)),
  };
}

export function sanitizeTableFrame(
  frame: Frame,
  viewport: { x?: number; y?: number; width: number; height: number },
): Frame {
  const minX = Number.isFinite(viewport.x) ? viewport.x! : 0;
  const minY = Number.isFinite(viewport.y) ? viewport.y! : 0;
  const width = clamp(frame.width, MIN_WIDTH, Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, viewport.width)));
  const height = clamp(frame.height, MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, viewport.height)));
  return {
    x: Math.round(clamp(frame.x, minX, minX + Math.max(0, viewport.width - width))),
    y: Math.round(clamp(frame.y, minY, minY + Math.max(0, viewport.height - height))),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function sameFrame(a: Frame, b: Frame) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
