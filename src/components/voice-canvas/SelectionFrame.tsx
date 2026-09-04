import type { KeyboardEvent, PointerEvent } from "react";
import type { ResizeHandle } from "./tableResize";

type SelectionFrameProps = {
  showRotation?: boolean;
  onResizePointerDown?: (handle: ResizeHandle, event: PointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown?: (handle: ResizeHandle, event: KeyboardEvent<HTMLButtonElement>) => void;
};

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function SelectionFrame({ showRotation = false, onResizePointerDown, onResizeKeyDown }: SelectionFrameProps) {
  const resizable = Boolean(onResizePointerDown);
  return (
    <span className={`selection-frame ${resizable ? "is-resizable" : ""}`} aria-hidden={resizable ? undefined : true}>
      {showRotation ? <span className="rotation-handle">↶</span> : null}
      {HANDLES.map((position) =>
        resizable ? (
          <button
            type="button"
            key={position}
            className={`selection-handle handle-${position}`}
            aria-label={`Resize table ${position}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => onResizePointerDown?.(position, event)}
            onKeyDown={(event) => onResizeKeyDown?.(position, event)}
          />
        ) : (
          <span key={position} className={`selection-handle handle-${position}`} />
        ),
      )}
    </span>
  );
}
