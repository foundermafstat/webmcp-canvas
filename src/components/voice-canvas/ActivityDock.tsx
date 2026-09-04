"use client";

import type { Feedback, WebMcpState } from "./useCanvasController";
import { Icon } from "./Icons";

type ActivityDockProps = {
  feedback: Feedback;
  version: number;
  webMcpState: WebMcpState;
  sheetOpen: boolean;
  onToggleSheet(): void;
  onUndo(): void;
  onEnterCanvasOnly(): void;
};

export function ActivityDock({
  feedback,
  version,
  webMcpState,
  sheetOpen,
  onToggleSheet,
  onUndo,
  onEnterCanvasOnly,
}: ActivityDockProps) {
  const statusLabel =
    webMcpState === "ready"
      ? "WebMCP ready"
      : webMcpState === "checking"
        ? "Checking WebMCP"
        : "WebMCP unavailable";

  return (
    <section className="activity-shell" aria-label="Command activity">
      <button
        className="sheet-handle"
        type="button"
        aria-expanded={sheetOpen}
        aria-controls="mobile-object-sheet"
        onClick={onToggleSheet}
      >
        <span />
        <span className="sr-only">{sheetOpen ? "Close objects" : "Open objects"}</span>
      </button>
      <div className="activity-dock">
        <div className={`activity-icon phase-${feedback.phase}`} aria-hidden="true">
          {feedback.phase === "conflict" || feedback.phase === "error" ? (
            <Icon name="warning" />
          ) : feedback.phase === "pending" ? (
            <span className="pending-ring" />
          ) : (
            <Icon name="spark" />
          )}
        </div>
        <div className="activity-summary">
          <strong>{feedback.title}</strong>
          <span>Version {version}</span>
        </div>
        <div className="activity-detail">
          <Icon name={feedback.phase === "conflict" || feedback.phase === "error" ? "warning" : "spark"} />
          <span>{feedback.detail}</span>
        </div>
        <button className="dock-action undo-action" type="button" onClick={onUndo}>
          <Icon name="undo" />
          <span>Undo</span>
        </button>
        <div className={`webmcp-state state-${webMcpState}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
        <button className="dock-more" type="button" onClick={onEnterCanvasOnly} aria-label="Enter canvas-only view">
          <Icon name="fit" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {feedback.title}. {feedback.detail}
      </p>
    </section>
  );
}
