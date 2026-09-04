"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  NodeResizer,
  ReactFlow,
  applyNodeChanges,
  useStoreApi,
  useViewport,
  type Node,
  type NodeChange,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import type { CanvasDocument, Frame, SceneObject } from "@/domain/types";
import { ChartObjectView } from "./ChartObjectView";
import { FreehandObjectView } from "./FreehandObjectView";
import { TableObjectView } from "./TableObjectView";
import type { CanvasViewport, CanvasViewportUpdate } from "./canvasViewport";
import { resizeRotatedFrame, type ResizeDirection } from "./rotatedResize";

type SceneCanvasProps = {
  document: CanvasDocument;
  selectedObjectId: string;
  animatingFreehandIds: ReadonlySet<string>;
  viewport: CanvasViewport;
  canvasOnly: boolean;
  onSelect(objectId: string): void;
  onResizeObject(objectId: string, frame: Frame): void;
  onRotateObject(objectId: string, rotation: number): void;
  onViewportChange(update: CanvasViewportUpdate): void;
};

type SceneNodeData = Record<string, unknown> & {
  object: SceneObject;
  animating: boolean;
  onSelect(objectId: string): void;
  onCommitFrame(objectId: string, frame: Frame): void;
  onCommitRotation(objectId: string, rotation: number): void;
};

type SceneFlowNode = Node<SceneNodeData, "sceneObject">;

function renderObject(object: SceneObject, animating: boolean) {
  if (object.type === "chart") return <ChartObjectView object={object} />;
  if (object.type === "freehand") return <FreehandObjectView object={object} animate={animating} />;
  if (object.type === "table") return <TableObjectView object={object} movable={!object.locked} />;
  if (object.type === "text") return <h1>{object.properties.plainText}</h1>;
  return (
    <>
      <svg className="annotation-arrow" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M58 60C35 50 33 29 29 13M19 23l10-10 12 9" />
      </svg>
      <p>{object.properties.text}</p>
    </>
  );
}

function normalizeRotation(value: number) {
  return ((value % 360) + 360) % 360;
}

const RESIZE_CONTROLS: Array<{
  key: string;
  classes: string;
  direction: ResizeDirection;
}> = [
  { key: "top", classes: "top line scene-resize-line", direction: { horizontal: 0, vertical: -1 } },
  { key: "right", classes: "right line scene-resize-line", direction: { horizontal: 1, vertical: 0 } },
  { key: "bottom", classes: "bottom line scene-resize-line", direction: { horizontal: 0, vertical: 1 } },
  { key: "left", classes: "left line scene-resize-line", direction: { horizontal: -1, vertical: 0 } },
  { key: "top-left", classes: "top left handle scene-resize-handle", direction: { horizontal: -1, vertical: -1 } },
  { key: "top-right", classes: "top right handle scene-resize-handle", direction: { horizontal: 1, vertical: -1 } },
  { key: "bottom-right", classes: "bottom right handle scene-resize-handle", direction: { horizontal: 1, vertical: 1 } },
  { key: "bottom-left", classes: "bottom left handle scene-resize-handle", direction: { horizontal: -1, vertical: 1 } },
];

function resizeCursor(direction: ResizeDirection, rotation: number) {
  const radians = rotation * Math.PI / 180;
  const x = direction.horizontal * Math.cos(radians) - direction.vertical * Math.sin(radians);
  const y = direction.horizontal * Math.sin(radians) + direction.vertical * Math.cos(radians);
  const angle = ((Math.atan2(y, x) * 180 / Math.PI) % 180 + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return "ew-resize";
  if (angle < 67.5) return "nwse-resize";
  if (angle < 112.5) return "ns-resize";
  return "nesw-resize";
}

function RotatedResizeControls({
  object,
  rotation,
  minWidth,
  minHeight,
  onCommitFrame,
}: {
  object: SceneObject;
  rotation: number;
  minWidth: number;
  minHeight: number;
  onCommitFrame(objectId: string, frame: Frame): void;
}) {
  const { zoom } = useViewport();
  const store = useStoreApi();
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    zoom: number;
    direction: ResizeDirection;
    startFrame: Frame;
    latestFrame: Frame;
  } | null>(null);

  const previewFrame = (frame: Frame, resizing: boolean) => {
    store.getState().triggerNodeChanges([
      { id: object.id, type: "position", position: { x: frame.x, y: frame.y } },
      {
        id: object.id,
        type: "dimensions",
        dimensions: { width: frame.width, height: frame.height },
        resizing,
        setAttributes: true,
      },
    ]);
  };

  const startResize = (direction: ResizeDirection, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      zoom,
      direction,
      startFrame: object.frame,
      latestFrame: object.frame,
    };
  };

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = resizeRotatedFrame(
      current.startFrame,
      rotation,
      current.direction,
      (event.clientX - current.startX) / current.zoom,
      (event.clientY - current.startY) / current.zoom,
      { minWidth, minHeight, maxWidth: 1_000, maxHeight: 720 },
    );
    current.latestFrame = frame;
    previewFrame(frame, true);
  };

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = null;
    const frame = Object.fromEntries(
      Object.entries(current.latestFrame).map(([key, value]) => [key, Math.round(value)]),
    ) as unknown as Frame;
    previewFrame(frame, false);
    if (!sameFrame(frame, object.frame)) onCommitFrame(object.id, frame);
  };

  const cancelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    previewFrame(object.frame, false);
  };

  return RESIZE_CONTROLS.map((control) => (
    <div
      key={control.key}
      className={`react-flow__resize-control nodrag nopan ${control.classes}`}
      style={{ cursor: resizeCursor(control.direction, rotation), touchAction: "none" }}
      onPointerDown={(event) => startResize(control.direction, event)}
      onPointerMove={moveResize}
      onPointerUp={finishResize}
      onPointerCancel={cancelResize}
    />
  ));
}

const SceneObjectNode = memo(function SceneObjectNode({ data, selected }: NodeProps<SceneFlowNode>) {
  const { object, animating, onSelect, onCommitFrame, onCommitRotation } = data;
  const canResize = selected && !object.locked && !animating;
  const minWidth = object.type === "chart" || object.type === "table" ? 240 : object.type === "text" ? 120 : 48;
  const minHeight = object.type === "chart" ? 180 : object.type === "table" ? 120 : object.type === "text" ? 44 : 48;
  const [previewRotation, setPreviewRotation] = useState(object.rotation ?? 0);
  const rotationGesture = useRef<{
    centerX: number;
    centerY: number;
    lastPointerAngle: number;
    rotation: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    if (!rotationGesture.current) setPreviewRotation(object.rotation ?? 0);
  }, [object.rotation]);

  const startRotation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = event.currentTarget.closest<HTMLElement>(".react-flow__node");
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rotationGesture.current = {
      centerX,
      centerY,
      lastPointerAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
      rotation: previewRotation,
      pointerId: event.pointerId,
    };
  };

  const moveRotation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = rotationGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerAngle = Math.atan2(event.clientY - gesture.centerY, event.clientX - gesture.centerX) * 180 / Math.PI;
    const delta = ((pointerAngle - gesture.lastPointerAngle + 540) % 360) - 180;
    gesture.lastPointerAngle = pointerAngle;
    gesture.rotation = normalizeRotation(gesture.rotation + delta);
    setPreviewRotation(gesture.rotation);
  };

  const finishRotation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = rotationGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    rotationGesture.current = null;
    const rotation = Math.round(gesture.rotation * 10) / 10;
    setPreviewRotation(rotation);
    if (Math.abs(rotation - (object.rotation ?? 0)) >= 0.1) onCommitRotation(object.id, rotation);
  };

  const cancelRotation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (rotationGesture.current?.pointerId !== event.pointerId) return;
    rotationGesture.current = null;
    setPreviewRotation(object.rotation ?? 0);
  };
  const isRotated = Math.min(normalizeRotation(previewRotation), 360 - normalizeRotation(previewRotation)) >= 0.1;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const direction = directions[event.key];
    if (!direction || object.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const distance = event.shiftKey ? 24 : 8;
    onCommitFrame(object.id, {
      ...object.frame,
      x: object.frame.x + direction.x * distance,
      y: object.frame.y + direction.y * distance,
    });
  };

  return (
    <div
      className={`scene-object object-${object.type} ${selected ? "is-selected" : ""}`}
      data-object-id={object.id}
      role="group"
      tabIndex={0}
      aria-label={`${object.type} object${selected ? ", selected" : ""}`}
      style={{ transform: `rotate(${previewRotation}deg)` }}
      onFocus={() => onSelect(object.id)}
      onKeyDown={handleKeyDown}
    >
      <NodeResizer
        isVisible={canResize && !isRotated}
        minWidth={minWidth}
        minHeight={minHeight}
        maxWidth={1_000}
        maxHeight={720}
        color="#1473e6"
        handleClassName="scene-resize-handle"
        lineClassName="scene-resize-line"
        onResizeEnd={(_event, frame) =>
          onCommitFrame(object.id, {
            x: Math.round(frame.x),
            y: Math.round(frame.y),
            width: Math.round(frame.width),
            height: Math.round(frame.height),
          })
        }
      />
      {canResize && isRotated ? (
        <RotatedResizeControls
          object={object}
          rotation={previewRotation}
          minWidth={minWidth}
          minHeight={minHeight}
          onCommitFrame={onCommitFrame}
        />
      ) : null}
      {canResize ? (
        <button
          className="rotation-handle scene-rotation-handle nodrag nopan"
          type="button"
          aria-label={`Rotate ${object.type} object`}
          title="Rotate object"
          onPointerDown={startRotation}
          onPointerMove={moveRotation}
          onPointerUp={finishRotation}
          onPointerCancel={cancelRotation}
          onClick={(event) => event.stopPropagation()}
        >
          ↻
        </button>
      ) : null}
      {renderObject(object, animating)}
    </div>
  );
});

const NODE_TYPES = { sceneObject: SceneObjectNode };

function toFlowNode(
  object: SceneObject,
  selectedObjectId: string,
  animatingFreehandIds: ReadonlySet<string>,
  onSelect: SceneNodeData["onSelect"],
  onCommitFrame: SceneNodeData["onCommitFrame"],
  onCommitRotation: SceneNodeData["onCommitRotation"],
): SceneFlowNode {
  return {
    id: object.id,
    type: "sceneObject",
    position: { x: object.frame.x, y: object.frame.y },
    width: object.frame.width,
    height: object.frame.height,
    zIndex: Number.parseInt(object.zIndex, 10) || 0,
    hidden: object.hidden,
    selected: object.id === selectedObjectId,
    draggable: !object.locked,
    focusable: false,
    selectable: true,
    connectable: false,
    deletable: false,
    dragHandle: object.type === "table" ? ".table-drag-handle" : undefined,
    ariaLabel: `${object.type} object${object.id === selectedObjectId ? ", selected" : ""}`,
    data: {
      object,
      animating: object.type === "freehand" && animatingFreehandIds.has(object.id),
      onSelect,
      onCommitFrame,
      onCommitRotation,
    },
  };
}

function sameFrame(a: Frame, b: Frame) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function nodeColor(node: SceneFlowNode) {
  switch (node.data.object.type) {
    case "chart": return "#ff6a55";
    case "table": return "#1473e6";
    case "freehand": return "#202020";
    case "annotation": return "#f1a43c";
    default: return "#8c8c8c";
  }
}

export function SceneCanvas({
  document,
  selectedObjectId,
  animatingFreehandIds,
  viewport,
  canvasOnly,
  onSelect,
  onResizeObject,
  onRotateObject,
  onViewportChange,
}: SceneCanvasProps) {
  const canonicalNodes = useMemo(
    () => document.rootObjectIds
      .map((id) => document.objects[id])
      .filter((object): object is SceneObject => Boolean(object))
      .map((object) => toFlowNode(
        object,
        selectedObjectId,
        animatingFreehandIds,
        onSelect,
        onResizeObject,
        onRotateObject,
      )),
    [animatingFreehandIds, document, onResizeObject, onRotateObject, onSelect, selectedObjectId],
  );
  const [nodes, setNodes] = useState<SceneFlowNode[]>(canonicalNodes);

  useEffect(() => {
    setNodes(canonicalNodes);
  }, [canonicalNodes]);

  const handleNodesChange = useCallback((changes: NodeChange<SceneFlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const handleNodeDragStop = useCallback((_event: MouseEvent | TouchEvent, node: SceneFlowNode) => {
    const object = document.objects[node.id];
    if (!object || object.locked) return;
    const nextFrame = {
      ...object.frame,
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    };
    if (!sameFrame(nextFrame, object.frame)) onResizeObject(object.id, nextFrame);
  }, [document.objects, onResizeObject]);

  const handleViewportChange = useCallback((next: Viewport) => {
    const nextViewport = { zoom: next.zoom * 100, panX: next.x, panY: next.y };
    if (
      Math.abs(nextViewport.zoom - viewport.zoom) < 0.01
      && Math.abs(nextViewport.panX - viewport.panX) < 0.01
      && Math.abs(nextViewport.panY - viewport.panY) < 0.01
    ) return;
    onViewportChange(nextViewport);
  }, [onViewportChange, viewport]);

  return (
    <main className={`canvas xyflow-canvas ${canvasOnly ? "is-canvas-only" : ""}`} aria-label={`${document.title} canvas`}>
      <ReactFlow<SceneFlowNode>
        nodes={nodes}
        edges={[]}
        nodeTypes={NODE_TYPES}
        viewport={{ x: viewport.panX, y: viewport.panY, zoom: viewport.zoom / 100 }}
        onViewportChange={handleViewportChange}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect("")}
        minZoom={0.25}
        maxZoom={3}
        colorMode="dark"
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling
        nodesDraggable
        nodesFocusable={false}
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#343841" />
        <MiniMap<SceneFlowNode>
          className="canvas-minimap"
          ariaLabel="Canvas minimap"
          pannable
          zoomable
          nodeColor={nodeColor}
          nodeStrokeColor="#2d323b"
          nodeStrokeWidth={2}
          nodeBorderRadius={3}
          maskColor="rgb(8 10 14 / 62%)"
          maskStrokeColor="#6ea8ff"
          maskStrokeWidth={1.5}
          bgColor="#191c22"
        />
      </ReactFlow>
    </main>
  );
}
