"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Frame, SceneObject } from "@/domain/types";
import { ActivityDock } from "./ActivityDock";
import { ObjectNavigator } from "./ObjectNavigator";
import { SceneCanvas } from "./SceneCanvas";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { useCanvasController } from "./useCanvasController";
import { Icon } from "./Icons";
import { persistCanvasViewMode, type CanvasViewMode } from "./canvasViewPreference";
import { zoomCanvasViewportAt } from "./canvasViewport";

export function VoiceCanvas() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [canvasOnly, setCanvasOnly] = useState(false);
  const setCanvasView = useCallback((mode: CanvasViewMode) => {
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = undefined;
    }
    persistCanvasViewMode(mode, storage, document.documentElement);
    if (mode === "canvas_only") setSheetOpen(false);
    setCanvasOnly(mode === "canvas_only");
  }, []);
  const controller = useCanvasController(setCanvasView);
  const objects = useMemo(
    () => controller.document.rootObjectIds.map((id) => controller.document.objects[id]).filter(Boolean),
    [controller.document],
  );
  const firstChartId = objects.find((object) => object.type === "chart")?.id;
  const commitObjectFrame = useCallback((objectId: string, frame: Frame) => {
    void controller.updateObject(objectId, { frame });
  }, [controller.updateObject]);
  const commitObjectRotation = useCallback((objectId: string, rotation: number) => {
    void controller.updateObject(objectId, { rotation });
  }, [controller.updateObject]);

  useLayoutEffect(() => {
    if (document.documentElement.dataset.canvasView === "canvas_only") {
      setSheetOpen(false);
      setCanvasOnly(true);
    }
  }, []);

  useEffect(() => {
    if (!canvasOnly) return;
    function exitOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCanvasView("standard");
    }
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [canvasOnly, setCanvasView]);

  function toggleHidden(object: SceneObject) {
    void controller.updateObject(object.id, { hidden: !object.hidden });
  }

  function toggleLocked(object: SceneObject) {
    void controller.updateObject(object.id, { locked: !object.locked });
  }

  const navigator = (
    <ObjectNavigator
      objects={objects}
      selectedObjectId={controller.selectedObjectId}
      zoom={controller.viewport.zoom}
      onSelect={controller.selectObject}
      onToggleHidden={toggleHidden}
      onToggleLocked={toggleLocked}
      onZoomChange={(zoom) =>
        controller.updateCanvasViewport((current) =>
          zoomCanvasViewportAt(current, zoom, { x: window.innerWidth / 2, y: window.innerHeight / 2 }),
        )
      }
      onEnterCanvasOnly={() => setCanvasView("canvas_only")}
    />
  );

  return (
    <div className={`voice-canvas-app ${canvasOnly ? "is-canvas-only" : ""}`}>
      {!canvasOnly ? (
        <TopBar
          documentTitle={controller.document.title}
          version={controller.document.documentVersion}
          webMcpState={controller.webMcpState}
          onUndo={() => void controller.undo()}
        />
      ) : null}
      <div className={`workspace ${canvasOnly ? "canvas-only-workspace" : ""}`}>
        <SceneCanvas
          document={controller.document}
          selectedObjectId={controller.selectedObjectId}
          animatingFreehandIds={controller.animatingFreehandIds}
          viewport={controller.viewport}
          canvasOnly={canvasOnly}
          onSelect={controller.selectObject}
          onResizeObject={commitObjectFrame}
          onRotateObject={commitObjectRotation}
          onViewportChange={controller.updateCanvasViewport}
        />
        {!canvasOnly ? (
          <>
            <Toolbar
              hasChart={Boolean(firstChartId)}
              onAddChart={() => void controller.addChart()}
              onAddFreehand={() => void controller.addFreehand()}
              onSelectChart={() => firstChartId && controller.selectObject(firstChartId)}
            />
            <aside className="desktop-objects" aria-label="Object navigator">
              {navigator}
            </aside>
            {sheetOpen ? (
              <aside className="mobile-object-sheet" id="mobile-object-sheet" aria-label="Object navigator">
                {navigator}
              </aside>
            ) : null}
            <ActivityDock
              feedback={controller.feedback}
              version={controller.document.documentVersion}
              webMcpState={controller.webMcpState}
              sheetOpen={sheetOpen}
              onToggleSheet={() => setSheetOpen((value) => !value)}
              onUndo={() => void controller.undo()}
              onEnterCanvasOnly={() => setCanvasView("canvas_only")}
            />
          </>
        ) : (
          <button
            className="canvas-view-toggle"
            type="button"
            onClick={() => setCanvasView("standard")}
            aria-label="Show interface"
            title="Show interface (Esc)"
          >
            <Icon name="fit" />
          </button>
        )}
      </div>
    </div>
  );
}
