import type { Frame } from "@/domain/types";

export type ResizeDirection = {
  horizontal: -1 | 0 | 1;
  vertical: -1 | 0 | 1;
};

type ResizeBounds = {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resizeRotatedFrame(
  frame: Frame,
  rotation: number,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  bounds: ResizeBounds,
): Frame {
  const radians = rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localDeltaX = deltaX * cosine + deltaY * sine;
  const localDeltaY = -deltaX * sine + deltaY * cosine;

  const width = direction.horizontal === 0
    ? frame.width
    : clamp(frame.width + direction.horizontal * localDeltaX, bounds.minWidth, bounds.maxWidth);
  const height = direction.vertical === 0
    ? frame.height
    : clamp(frame.height + direction.vertical * localDeltaY, bounds.minHeight, bounds.maxHeight);

  const appliedX = direction.horizontal === 0 ? 0 : (width - frame.width) / direction.horizontal;
  const appliedY = direction.vertical === 0 ? 0 : (height - frame.height) / direction.vertical;
  const centerX = frame.x + frame.width / 2 + (cosine * appliedX - sine * appliedY) / 2;
  const centerY = frame.y + frame.height / 2 + (sine * appliedX + cosine * appliedY) / 2;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}
