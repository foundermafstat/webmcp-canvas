import type { CommandGateway } from "@/domain/gateway";
import type {
  AddChartPayload,
  AddFreehandPayload,
  AddTablePayload,
  CanvasCommand,
  CanvasDocument,
  CommandResult,
  UpdateObjectPayload,
} from "@/domain/types";
import { AGENT_ACTOR } from "@/domain/types";
import {
  addChartInputSchema,
  addFreehandInputSchema,
  addTableInputSchema,
  getObjectInputSchema,
  getSceneSummaryInputSchema,
  setCanvasViewInputSchema,
  setCanvasViewportInputSchema,
  undoInputSchema,
  updateObjectInputSchema,
} from "./schemas";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

export type ModelContext = {
  registerTool(definition: ToolDefinition): void | Promise<void>;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export type ActiveDocumentContext = {
  requireCurrent(): { document: CanvasDocument; selectedObjectIds: string[] };
};

type RegistrationOptions = {
  context: ActiveDocumentContext;
  gateway: CommandGateway;
  onInvocation?: (phase: "pending" | "complete", result?: CommandResult) => void;
  onCanvasViewChange?: (mode: "canvas_only" | "standard") => void;
  onCanvasViewportChange?: (request: CanvasViewportRequest) => unknown;
  modelContext?: ModelContext;
  isTopLevel?: boolean;
};

export type CanvasViewportRequest = {
  zoom?: number;
  panX?: number;
  panY?: number;
  focusObjectId?: string;
  fit?: boolean;
};

export type WebMcpRegistration =
  | { status: "ready"; registeredTools: string[] }
  | { status: "unavailable"; registeredTools: []; reason: "unsupported" | "iframe" | "registration_failed" };

const registryHost = globalThis as typeof globalThis & {
  __voiceCanvasWebMcpRegistrations__?: WeakMap<ModelContext, Set<string>>;
};
const registeredToolsByContext =
  registryHost.__voiceCanvasWebMcpRegistrations__ ??= new WeakMap<ModelContext, Set<string>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function validObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/.test(value);
}

function invalidInput(tool: string) {
  return {
    status: "rejected",
    errorCode: "INVALID_TOOL_INPUT",
    summary: `${tool} received unknown or malformed fields.`,
    retryable: false,
  };
}

function makeCorrelationId() {
  return `corr_${crypto.randomUUID().replaceAll("-", "")}`;
}

function writeEnvelope(input: Record<string, unknown>) {
  if (
    typeof input.operationId !== "string" ||
    !Number.isInteger(input.expectedDocumentVersion)
  ) {
    return null;
  }
  return {
    operationId: input.operationId,
    expectedDocumentVersion: input.expectedDocumentVersion as number,
    correlationId: makeCorrelationId(),
  };
}

async function executeWrite(
  options: RegistrationOptions,
  contextVersion: number,
  command: CanvasCommand,
) {
  if (options.gateway.getSnapshot().documentVersion !== contextVersion) {
    return {
      status: "rejected",
      operationId: command.operationId,
      documentVersion: options.gateway.getSnapshot().documentVersion,
      objectIds: [],
      eventIds: [],
      summary: "The active document changed before the command could run.",
      retryable: false,
      errorCode: "TOOL_UNAVAILABLE",
    } satisfies CommandResult;
  }
  options.onInvocation?.("pending");
  let result: CommandResult;
  try {
    result = options.gateway.execute(command, AGENT_ACTOR);
  } catch {
    result = {
      status: "rejected",
      operationId: command.operationId,
      documentVersion: options.gateway.getSnapshot().documentVersion,
      objectIds: [],
      eventIds: [],
      summary: "The command could not be persisted locally.",
      retryable: true,
      errorCode: "PERSISTENCE_ERROR",
    };
  }
  options.onInvocation?.("complete", result);
  return result;
}

export async function registerWebMcpTools(options: RegistrationOptions): Promise<WebMcpRegistration> {
  const isTopLevel = options.isTopLevel ?? (typeof window !== "undefined" && window.top === window.self);
  if (!isTopLevel) return { status: "unavailable", registeredTools: [], reason: "iframe" };

  const modelContext = options.modelContext ?? (typeof document !== "undefined" ? document.modelContext : undefined);
  if (!modelContext?.registerTool) {
    return { status: "unavailable", registeredTools: [], reason: "unsupported" };
  }

  const names = [
    "get_scene_summary",
    "get_object",
    "add_chart",
    "add_freehand",
    "add_table",
    "update_object",
    "undo",
    "set_canvas_view",
    "set_canvas_viewport",
  ];

  const definitions: ToolDefinition[] = [
    {
      name: "get_scene_summary",
      description: "Read a bounded summary of the currently open webmcp-canvas scene. No side effects.",
      inputSchema: getSceneSummaryInputSchema,
      annotations: { readOnlyHint: true },
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["detail", "includeRecentChanges"]) ||
          (input.detail !== "compact" && input.detail !== "standard") ||
          typeof input.includeRecentChanges !== "boolean"
        ) {
          return invalidInput("get_scene_summary");
        }
        const current = options.context.requireCurrent();
        return options.gateway.getSceneSummary(current.selectedObjectIds);
      },
    },
    {
      name: "get_object",
      description: "Read one bounded object from the currently open webmcp-canvas scene. No side effects.",
      inputSchema: getObjectInputSchema,
      annotations: { readOnlyHint: true },
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["objectId", "includeDataPreview"]) ||
          !validObjectId(input.objectId) ||
          typeof input.includeDataPreview !== "boolean"
        ) {
          return invalidInput("get_object");
        }
        const current = options.context.requireCurrent();
        const object = options.gateway.getObject(input.objectId);
        return object
          ? { documentVersion: current.document.documentVersion, object }
          : {
              status: "rejected",
              errorCode: "OBJECT_NOT_FOUND",
              documentVersion: current.document.documentVersion,
              summary: "Object not found.",
              retryable: false,
            };
      },
    },
    {
      name: "add_chart",
      description: "Add one validated semantic bar chart to the current canvas. This changes the document and is undoable.",
      inputSchema: addChartInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["operationId", "expectedDocumentVersion", "chartSpec", "placement", "selectAfterCreate"]) ||
          !isRecord(input.chartSpec) ||
          !hasOnlyKeys(input.chartSpec, ["kind", "title", "categories", "values", "colorToken"]) ||
          (input.placement !== undefined &&
            (!isRecord(input.placement) || !hasOnlyKeys(input.placement, ["x", "y", "width", "height"]))) ||
          (input.selectAfterCreate !== undefined && typeof input.selectAfterCreate !== "boolean")
        ) {
          return invalidInput("add_chart");
        }
        const envelope = writeEnvelope(input);
        if (!envelope) return invalidInput("add_chart");
        const current = options.context.requireCurrent();
        return executeWrite(options, current.document.documentVersion, {
          ...envelope,
          commandType: "AddChart",
          payload: {
            chartSpec: input.chartSpec as unknown as AddChartPayload["chartSpec"],
            placement: input.placement as AddChartPayload["placement"],
            selectAfterCreate: input.selectAfterCreate as boolean | undefined,
          },
        });
      },
    },
    {
      name: "add_freehand",
      description:
        "Add one validated closed freehand stroke. Points are local coordinates inside the placement frame. This changes the document and is undoable.",
      inputSchema: addFreehandInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, [
            "operationId",
            "expectedDocumentVersion",
            "label",
            "points",
            "strokeToken",
            "strokeWidth",
            "placement",
            "selectAfterCreate",
          ]) ||
          typeof input.label !== "string" ||
          input.label.trim().length === 0 ||
          input.label.length > 80 ||
          !Array.isArray(input.points) ||
          input.points.length < 8 ||
          input.points.length > 256 ||
          input.points.some(
            (point) =>
              !isRecord(point) ||
              !hasOnlyKeys(point, ["x", "y", "pressure"]) ||
              typeof point.x !== "number" ||
              !Number.isFinite(point.x) ||
              point.x < 0 ||
              point.x > 1_000 ||
              typeof point.y !== "number" ||
              !Number.isFinite(point.y) ||
              point.y < 0 ||
              point.y > 1_000 ||
              (point.pressure !== undefined &&
                (typeof point.pressure !== "number" ||
                  !Number.isFinite(point.pressure) ||
                  point.pressure < 0 ||
                  point.pressure > 1)),
          ) ||
          (input.strokeToken !== "coral" && input.strokeToken !== "ink") ||
          typeof input.strokeWidth !== "number" ||
          !Number.isFinite(input.strokeWidth) ||
          input.strokeWidth < 1 ||
          input.strokeWidth > 24 ||
          !isRecord(input.placement) ||
          !hasOnlyKeys(input.placement, ["x", "y", "width", "height"]) ||
          ![input.placement.x, input.placement.y, input.placement.width, input.placement.height].every(
            (value) => typeof value === "number" && Number.isFinite(value),
          ) ||
          (input.selectAfterCreate !== undefined && typeof input.selectAfterCreate !== "boolean")
        ) {
          return invalidInput("add_freehand");
        }
        const envelope = writeEnvelope(input);
        if (!envelope) return invalidInput("add_freehand");
        const current = options.context.requireCurrent();
        return executeWrite(options, current.document.documentVersion, {
          ...envelope,
          commandType: "AddFreehand",
          payload: {
            label: input.label,
            points: input.points,
            strokeToken: input.strokeToken,
            strokeWidth: input.strokeWidth,
            placement: input.placement,
            selectAfterCreate: input.selectAfterCreate,
          } as AddFreehandPayload,
        });
      },
    },
    {
      name: "add_table",
      description:
        "Add one semantic plain-data table with bounded columns and scalar cells. This changes the document and is undoable.",
      inputSchema: addTableInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, [
            "operationId",
            "expectedDocumentVersion",
            "title",
            "columns",
            "rows",
            "placement",
            "selectAfterCreate",
          ]) ||
          typeof input.title !== "string" ||
          input.title.trim().length === 0 ||
          input.title.length > 80 ||
          !Array.isArray(input.columns) ||
          input.columns.length < 2 ||
          input.columns.length > 6 ||
          input.columns.some(
            (column) => typeof column !== "string" || column.trim().length === 0 || column.length > 32,
          ) ||
          !Array.isArray(input.rows) ||
          input.rows.length < 1 ||
          input.rows.length > 12 ||
          input.rows.some(
            (row) =>
              !Array.isArray(row) ||
              row.length !== (input.columns as unknown[]).length ||
              row.some(
                (cell) =>
                  !(
                    (typeof cell === "string" && cell.length <= 80 && !/[\u0000-\u001f\u007f]/.test(cell)) ||
                    (typeof cell === "number" && Number.isFinite(cell) && Math.abs(cell) <= 1_000_000_000)
                  ),
              ),
          ) ||
          !isRecord(input.placement) ||
          !hasOnlyKeys(input.placement, ["x", "y", "width", "height"]) ||
          ![input.placement.x, input.placement.y, input.placement.width, input.placement.height].every(
            (value) => typeof value === "number" && Number.isFinite(value),
          ) ||
          (input.selectAfterCreate !== undefined && typeof input.selectAfterCreate !== "boolean")
        ) {
          return invalidInput("add_table");
        }
        const envelope = writeEnvelope(input);
        if (!envelope) return invalidInput("add_table");
        const current = options.context.requireCurrent();
        return executeWrite(options, current.document.documentVersion, {
          ...envelope,
          commandType: "AddTable",
          payload: {
            title: input.title,
            columns: input.columns,
            rows: input.rows,
            placement: input.placement,
            selectAfterCreate: input.selectAfterCreate,
          } as AddTablePayload,
        });
      },
    },
    {
      name: "update_object",
      description: "Update allowlisted fields on one exact object in the current canvas. This changes the document and is undoable.",
      inputSchema: updateObjectInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["operationId", "expectedDocumentVersion", "objectId", "changes", "selectAfterUpdate"]) ||
          !validObjectId(input.objectId) ||
          !isRecord(input.changes) ||
          !hasOnlyKeys(input.changes, ["title", "colorToken", "hidden", "locked", "rotation", "frame"]) ||
          (input.changes.rotation !== undefined &&
            (typeof input.changes.rotation !== "number" ||
              !Number.isFinite(input.changes.rotation) ||
              input.changes.rotation < -360 ||
              input.changes.rotation > 360)) ||
          (input.changes.frame !== undefined &&
            (!isRecord(input.changes.frame) ||
              Object.keys(input.changes.frame).length === 0 ||
              !hasOnlyKeys(input.changes.frame, ["x", "y", "width", "height"]) ||
              Object.values(input.changes.frame).some(
                (value) => typeof value !== "number" || !Number.isFinite(value),
              ))) ||
          (input.selectAfterUpdate !== undefined && typeof input.selectAfterUpdate !== "boolean")
        ) {
          return invalidInput("update_object");
        }
        const envelope = writeEnvelope(input);
        if (!envelope) return invalidInput("update_object");
        const current = options.context.requireCurrent();
        return executeWrite(options, current.document.documentVersion, {
          ...envelope,
          commandType: "UpdateObject",
          payload: {
            objectId: input.objectId as string,
            changes: input.changes as UpdateObjectPayload["changes"],
            selectAfterUpdate: input.selectAfterUpdate as boolean | undefined,
          },
        });
      },
    },
    {
      name: "undo",
      description: "Create a compensating event for the latest reversible canvas change. This changes the document.",
      inputSchema: undoInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["operationId", "expectedDocumentVersion", "targetOperationId"]) ||
          (input.targetOperationId !== undefined && typeof input.targetOperationId !== "string")
        ) {
          return invalidInput("undo");
        }
        const envelope = writeEnvelope(input);
        if (!envelope) return invalidInput("undo");
        const current = options.context.requireCurrent();
        return executeWrite(options, current.document.documentVersion, {
          ...envelope,
          commandType: "Undo",
          payload: {
            ...(typeof input.targetOperationId === "string"
              ? { targetOperationId: input.targetOperationId }
              : {}),
          },
        });
      },
    },
    {
      name: "set_canvas_view",
      description:
        "Switch the current webmcp-canvas UI between a clean canvas-only view and the standard editing interface. Does not change the document or history.",
      inputSchema: setCanvasViewInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["mode"]) ||
          (input.mode !== "canvas_only" && input.mode !== "standard")
        ) {
          return invalidInput("set_canvas_view");
        }
        options.onCanvasViewChange?.(input.mode);
        return {
          status: "applied",
          mode: input.mode,
          summary: input.mode === "canvas_only" ? "Canvas-only view enabled." : "Standard interface restored.",
        };
      },
    },
    {
      name: "set_canvas_viewport",
      description:
        "Set bounded canvas zoom or pan, or center and optionally fit one exact scene object. Does not change the document or history.",
      inputSchema: setCanvasViewportInputSchema,
      execute: (input) => {
        if (
          !isRecord(input) ||
          Object.keys(input).length === 0 ||
          !hasOnlyKeys(input, ["zoom", "panX", "panY", "focusObjectId", "fit"]) ||
          (input.zoom !== undefined &&
            (typeof input.zoom !== "number" || !Number.isFinite(input.zoom) || input.zoom < 25 || input.zoom > 300)) ||
          (input.panX !== undefined &&
            (typeof input.panX !== "number" || !Number.isFinite(input.panX) || Math.abs(input.panX) > 10_000)) ||
          (input.panY !== undefined &&
            (typeof input.panY !== "number" || !Number.isFinite(input.panY) || Math.abs(input.panY) > 10_000)) ||
          (input.focusObjectId !== undefined && !validObjectId(input.focusObjectId)) ||
          (input.fit !== undefined && typeof input.fit !== "boolean") ||
          (input.fit === true && input.focusObjectId === undefined)
        ) {
          return invalidInput("set_canvas_viewport");
        }
        if (!options.onCanvasViewportChange) {
          return {
            status: "rejected",
            errorCode: "TOOL_UNAVAILABLE",
            summary: "Canvas viewport control is unavailable.",
            retryable: false,
          };
        }
        return options.onCanvasViewportChange(input as CanvasViewportRequest);
      },
    },
  ];

  const registered = registeredToolsByContext.get(modelContext) ?? new Set<string>();
  const missing = definitions.filter((definition) => !registered.has(definition.name));
  if (missing.length === 0) return { status: "ready", registeredTools: names };

  const outcomes = await Promise.allSettled(
    missing.map((definition) => modelContext.registerTool(definition)),
  );
  const succeeded = missing.filter((_, index) => outcomes[index]?.status === "fulfilled");
  for (const definition of succeeded) registered.add(definition.name);

  if (succeeded.length === 0) {
    registeredToolsByContext.set(modelContext, registered);
    return { status: "unavailable", registeredTools: [], reason: "registration_failed" };
  }

  // During Fast Refresh, the host may reject names that it already owns while
  // accepting a newly added tool. A mixed result therefore reconciles the
  // durable client registry without surfacing an unhandled rejection.
  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    for (const definition of missing) registered.add(definition.name);
  }
  registeredToolsByContext.set(modelContext, registered);
  return { status: "ready", registeredTools: names };
}
