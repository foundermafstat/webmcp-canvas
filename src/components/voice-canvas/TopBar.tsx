"use client";

import { useState } from "react";
import { Icon, VoiceCanvasMark } from "./Icons";
import type { WebMcpState } from "./useCanvasController";

type TopBarProps = {
  documentTitle: string;
  version: number;
  webMcpState: WebMcpState;
  onUndo(): void;
};

export function TopBar({ documentTitle, version, webMcpState, onUndo }: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<"document" | "version" | "share" | "more" | null>(null);
  const statusLabel =
    webMcpState === "ready"
      ? "WebMCP ready"
      : webMcpState === "checking"
        ? "Checking WebMCP"
        : "WebMCP unavailable";

  function toggle(menu: NonNullable<typeof openMenu>) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  return (
    <header className="top-bar">
      <div className="brand">
        <VoiceCanvasMark />
        <strong>Voice Canvas</strong>
      </div>
      <span className="header-divider" />
      <button className="document-menu" type="button" onClick={() => toggle("document")} aria-expanded={openMenu === "document"}>
        <span>{documentTitle}</span>
        <Icon name="chevron" />
      </button>
      <div className="header-spacer" />
      <button className="header-action desktop-header-action" type="button" onClick={onUndo}>
        <Icon name="undo" />
        <span>Undo</span>
      </button>
      <div className={`header-status desktop-header-action state-${webMcpState}`}>
        <Icon name="cloud" />
        <span className="status-dot" aria-hidden="true" />
        <span>{statusLabel}</span>
      </div>
      <button
        className="header-action version-action desktop-header-action"
        type="button"
        onClick={() => toggle("version")}
        aria-expanded={openMenu === "version"}
      >
        <span>Version {version}</span>
        <Icon name="chevron" />
      </button>
      <button className="header-icon desktop-header-action" type="button" onClick={() => toggle("share")} aria-label="Export options">
        <Icon name="share" />
      </button>
      <button className="header-icon" type="button" onClick={() => toggle("more")} aria-label="More options" aria-expanded={openMenu === "more"}>
        <Icon name="more" />
      </button>
      {openMenu ? (
        <div className={`header-popover menu-${openMenu}`} role="status">
          {openMenu === "document" ? `${documentTitle} · local prototype` : null}
          {openMenu === "version" ? `${version - 1} command groups saved locally` : null}
          {openMenu === "share" ? "Export is planned after P2" : null}
          {openMenu === "more" ? `Version ${version} · local persistence` : null}
        </div>
      ) : null}
    </header>
  );
}
