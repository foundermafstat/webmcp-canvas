"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDemoDocument } from "@/domain/fixtures";
import { CommandGateway } from "@/domain/gateway";
import {
  LocalSceneRepository,
  MemorySceneRepository,
  type SceneRepository,
} from "@/domain/persistence";
import type { ActorRef, CanvasCommand, CanvasDocument, CommandResult } from "@/domain/types";
import { LOCAL_ACTOR } from "@/domain/types";
import { registerWebMcpTools, type CanvasViewportRequest } from "@/webmcp/register";
import {
  DEFAULT_CANVAS_VIEWPORT,
  focusCanvasFrame,
  normalizeCanvasViewport,
  zoomCanvasViewportAt,
  type CanvasViewportUpdate,
} from "./canvasViewport";

export type Feedback = {
  phase: "pending" | "applied" | "conflict" | "error";
  actor: "human" | "agent";
  title: string;
  detail: string;
};

export type WebMcpState = "checking" | "ready" | "unavailable";

const INITIAL_DOCUMENT = createDemoDocument();

function makeOperationId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function makeCorrelationId() {
  return makeOperationId("corr");
}

function centeredCirclePoints(size: number) {
  const center = size / 2;
  const radius = size / 2 - 14;
  return Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    const wobble = 1 + Math.sin(index * 2.7) * 0.018;
    return {
      x: center + Math.cos(angle) * radius * wobble,
      y: center + Math.sin(angle) * radius * wobble,
      pressure: 0.68 + Math.sin(index * 1.9) * 0.08,
    };
  });
}

function feedbackFromResult(result: CommandResult, actor: "human" | "agent"): Feedback {
  if (result.status === "conflict") {
    return {
      phase: "conflict",
      actor,
      title: "Version conflict",
      detail: `${result.summary} Read the scene again before retrying.`,
    };
  }
  if (result.status === "rejected") {
    return { phase: "error", actor, title: "Command not applied", detail: result.summary };
  }
  return {
    phase: "applied",
    actor,
    title: actor === "agent" ? "Agent updated canvas" : result.summary,
    detail:
      result.status === "duplicate"
        ? "The original result was returned without a second event."
        : actor === "agent"
          ? "The agent command was validated and persisted locally."
          : `Saved locally as version ${result.documentVersion}.`,
  };
}

export function useCanvasController(onCanvasViewChange?: (mode: "canvas_only" | "standard") => void) {
  const [documentState, setDocumentState] = useState<CanvasDocument>(INITIAL_DOCUMENT);
  const [selectedObjectId, setSelectedObjectId] = useState<string>("obj_chart_sales_q1");
  const [webMcpState, setWebMcpState] = useState<WebMcpState>("checking");
  const [feedback, setFeedback] = useState<Feedback>({
    phase: "applied",
    actor: "agent",
    title: "Agent updated chart",
    detail: "Agent updated the chart data based on Q1 sales figures.",
  });
  const [hydrated, setHydrated] = useState(false);
  const [viewport, setViewportState] = useState(DEFAULT_CANVAS_VIEWPORT);
  const [animatingFreehandIds, setAnimatingFreehandIds] = useState<ReadonlySet<string>>(() => new Set());
  const documentRef = useRef(documentState);
  const selectedRef = useRef(selectedObjectId);
  const animationTimersRef = useRef(new Map<string, number>());
  const viewportRef = useRef(viewport);
  const gatewayRef = useRef(
    new CommandGateway(INITIAL_DOCUMENT, new MemorySceneRepository(INITIAL_DOCUMENT)),
  );

  documentRef.current = documentState;
  selectedRef.current = selectedObjectId;
  viewportRef.current = viewport;

  const updateCanvasViewport = useCallback((update: CanvasViewportUpdate) => {
    setViewportState((current) => {
      const next = normalizeCanvasViewport(typeof update === "function" ? update(current) : update);
      viewportRef.current = next;
      return next;
    });
  }, []);

  const applyCanvasViewportRequest = useCallback((request: CanvasViewportRequest) => {
    const canvasOnly = document.documentElement.dataset.canvasView === "canvas_only";
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const canvas = {
      width: window.innerWidth - (canvasOnly || mobile ? 0 : 258),
      height: window.innerHeight - (canvasOnly ? 0 : mobile ? 54 : 58),
    };
    const current = viewportRef.current;
    let next = current;
    if (request.focusObjectId) {
      const object = gatewayRef.current.getObject(request.focusObjectId);
      if (!object) {
        return {
          status: "rejected",
          errorCode: "OBJECT_NOT_FOUND",
          summary: "Object not found.",
          retryable: false,
        };
      }
      next = focusCanvasFrame(current, object.frame, canvas, request.fit === true, request.zoom);
    } else if (request.zoom !== undefined) {
      next = zoomCanvasViewportAt(current, request.zoom, { x: canvas.width / 2, y: canvas.height / 2 });
    }
    next = normalizeCanvasViewport({
      ...next,
      ...(request.panX !== undefined ? { panX: request.panX } : {}),
      ...(request.panY !== undefined ? { panY: request.panY } : {}),
    });
    viewportRef.current = next;
    setViewportState(next);
    return {
      status: "applied",
      viewport: next,
      ...(request.focusObjectId ? { focusedObjectId: request.focusObjectId } : {}),
      summary: request.focusObjectId ? "Canvas centered on the requested object." : "Canvas viewport updated.",
    };
  }, []);

  const animateNewFreehand = useCallback((objectId: string) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAnimatingFreehandIds((current) => new Set(current).add(objectId));
    const existingTimer = animationTimersRef.current.get(objectId);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      animationTimersRef.current.delete(objectId);
      setAnimatingFreehandIds((current) => {
        const next = new Set(current);
        next.delete(objectId);
        return next;
      });
    }, 850);
    animationTimersRef.current.set(objectId, timer);
  }, []);

  const syncFromGateway = useCallback((result: CommandResult, actor: "human" | "agent") => {
    const nextDocument = gatewayRef.current.getSnapshot();
    documentRef.current = nextDocument;
    setDocumentState(nextDocument);
    const firstObjectId = result.objectIds.find((id) => Boolean(nextDocument.objects[id]));
    if ((result.status === "applied" || result.status === "duplicate") && firstObjectId) {
      selectedRef.current = firstObjectId;
      setSelectedObjectId(firstObjectId);
    } else if (selectedRef.current && !nextDocument.objects[selectedRef.current]) {
      selectedRef.current = "";
      setSelectedObjectId("");
    }
    if (result.status === "applied") {
      const addedFreehand = nextDocument.events.find(
        (event) =>
          result.eventIds.includes(event.eventId) &&
          event.eventType === "ObjectAdded" &&
          event.after?.type === "freehand",
      );
      if (addedFreehand?.after?.type === "freehand") animateNewFreehand(addedFreehand.after.id);
    }
    setFeedback(feedbackFromResult(result, actor));
  }, [animateNewFreehand]);

  useEffect(() => () => {
    for (const timer of animationTimersRef.current.values()) window.clearTimeout(timer);
    animationTimersRef.current.clear();
  }, []);

  useEffect(() => {
    let repository: SceneRepository = new LocalSceneRepository(window.localStorage);
    let initial = repository.load() ?? createDemoDocument();
    try {
      repository.save(initial);
    } catch {
      initial = createDemoDocument();
      repository = new MemorySceneRepository(initial);
      setFeedback({
        phase: "error",
        actor: "human",
        title: "Local persistence unavailable",
        detail: "This session remains usable, but changes will not survive reload.",
      });
    }
    gatewayRef.current = new CommandGateway(initial, repository);
    documentRef.current = initial;
    setDocumentState(initial);
    if (!initial.objects[selectedRef.current]) {
      const chartId = initial.rootObjectIds.find((id) => initial.objects[id]?.type === "chart") ?? "";
      selectedRef.current = chartId;
      setSelectedObjectId(chartId);
    }
    setHydrated(true);
  }, []);

  const onAgentInvocation = useCallback(
    (phase: "pending" | "complete", result?: CommandResult) => {
      if (phase === "pending") {
        setFeedback({
          phase: "pending",
          actor: "agent",
          title: "Agent is applying a command",
          detail: "Validating the current document version and tool input.",
        });
      } else if (result) {
        syncFromGateway(result, "agent");
      }
    },
    [syncFromGateway],
  );

  useEffect(() => {
    if (!hydrated) return;
    void registerWebMcpTools({
      gateway: gatewayRef.current,
      context: {
        requireCurrent: () => ({
          document: documentRef.current,
          selectedObjectIds: selectedRef.current ? [selectedRef.current] : [],
        }),
      },
      onInvocation: onAgentInvocation,
      onCanvasViewChange,
      onCanvasViewportChange: applyCanvasViewportRequest,
    }).then((registration) => {
      setWebMcpState(registration.status === "ready" ? "ready" : "unavailable");
    }).catch(() => {
      setWebMcpState("unavailable");
      setFeedback({
        phase: "error",
        actor: "agent",
        title: "WebMCP unavailable",
        detail: "Tool registration failed safely. Canvas controls remain available.",
      });
    });
  }, [applyCanvasViewportRequest, hydrated, onAgentInvocation, onCanvasViewChange]);

  const runHumanCommand = useCallback(
    async (command: CanvasCommand) => {
      setFeedback({
        phase: "pending",
        actor: "human",
        title: "Applying your change",
        detail: "Validating and saving the command locally.",
      });
      let result: CommandResult;
      try {
        result = gatewayRef.current.execute(command, LOCAL_ACTOR);
      } catch {
        result = {
          status: "rejected",
          operationId: command.operationId,
          documentVersion: gatewayRef.current.getSnapshot().documentVersion,
          objectIds: [],
          eventIds: [],
          summary: "The change could not be persisted locally.",
          retryable: true,
          errorCode: "PERSISTENCE_ERROR",
        };
      }
      syncFromGateway(result, "human");
      return result;
    },
    [syncFromGateway],
  );

  const addChart = useCallback(() => {
    const snapshot = gatewayRef.current.getSnapshot();
    const chartCount = snapshot.rootObjectIds.filter((id) => snapshot.objects[id]?.type === "chart").length;
    return runHumanCommand({
      commandType: "AddChart",
      operationId: makeOperationId("human_add_chart"),
      correlationId: makeCorrelationId(),
      expectedDocumentVersion: snapshot.documentVersion,
      payload: {
        chartSpec: {
          kind: "bar",
          title: `Sales chart ${chartCount + 1}`,
          categories: ["Jan", "Feb", "Mar"],
          values: [10, 14, 9],
          colorToken: "duo",
        },
        placement: { x: 350 + chartCount * 30, y: 208 + chartCount * 24, width: 570, height: 365 },
        selectAfterCreate: true,
      },
    });
  }, [runHumanCommand]);

  const addFreehand = useCallback(() => {
    const snapshot = gatewayRef.current.getSnapshot();
    const size = 210;
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const canvasWidth = window.innerWidth - (mobile ? 0 : 258);
    const canvasHeight = window.innerHeight - (mobile ? 54 : 58);
    return runHumanCommand({
      commandType: "AddFreehand",
      operationId: makeOperationId("human_add_freehand"),
      correlationId: makeCorrelationId(),
      expectedDocumentVersion: snapshot.documentVersion,
      payload: {
        label: "Hand-drawn circle",
        points: centeredCirclePoints(size),
        strokeToken: "coral",
        strokeWidth: 6,
        placement: {
          x: Math.max(90, Math.round((canvasWidth - size) / 2)),
          y: Math.max(32, Math.round((canvasHeight - size) / 2)),
          width: size,
          height: size,
        },
        selectAfterCreate: true,
      },
    });
  }, [runHumanCommand]);

  const updateObject = useCallback(
    (objectId: string, changes: Extract<CanvasCommand, { commandType: "UpdateObject" }>["payload"]["changes"]) => {
      const snapshot = gatewayRef.current.getSnapshot();
      return runHumanCommand({
        commandType: "UpdateObject",
        operationId: makeOperationId("human_update"),
        correlationId: makeCorrelationId(),
        expectedDocumentVersion: snapshot.documentVersion,
        payload: { objectId, changes, selectAfterUpdate: true },
      });
    },
    [runHumanCommand],
  );

  const undo = useCallback(() => {
    const snapshot = gatewayRef.current.getSnapshot();
    return runHumanCommand({
      commandType: "Undo",
      operationId: makeOperationId("human_undo"),
      correlationId: makeCorrelationId(),
      expectedDocumentVersion: snapshot.documentVersion,
      payload: {},
    });
  }, [runHumanCommand]);

  const selectObject = useCallback((objectId: string) => {
    selectedRef.current = objectId;
    setSelectedObjectId(objectId);
  }, []);

  return {
    document: documentState,
    selectedObjectId,
    webMcpState,
    feedback,
    viewport,
    updateCanvasViewport,
    animatingFreehandIds,
    addChart,
    addFreehand,
    updateObject,
    undo,
    selectObject,
  };
}
