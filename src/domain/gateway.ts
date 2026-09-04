import type { SceneRepository } from "./persistence";
import type {
  ActorRef,
  AddChartPayload,
  AddFreehandPayload,
  AddTablePayload,
  CanvasCommand,
  CanvasDocument,
  ChartColorToken,
  ChartObject,
  CommandResult,
  DomainEvent,
  Frame,
  FreehandObject,
  FreehandStrokeToken,
  Provenance,
  SceneObject,
  SceneSummary,
  TableObject,
  UpdateObjectPayload,
} from "./types";

type GatewayDependencies = {
  makeId?: (prefix: "obj" | "evt") => string;
  now?: () => string;
};

const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,63}$/;
const OBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const COLOR_TOKENS = new Set<ChartColorToken>(["duo", "coral", "ink", "green"]);
const FREEHAND_STROKE_TOKENS = new Set<FreehandStrokeToken>(["coral", "ink"]);

function defaultMakeId(prefix: "obj" | "evt") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function objectLabel(object: SceneObject) {
  if (object.type === "chart") return object.properties.title;
  if (object.type === "text") return object.properties.plainText;
  if (object.type === "annotation") return object.properties.text;
  if (object.type === "freehand") return object.properties.label;
  return object.properties.title;
}

function rejected(command: CanvasCommand, version: number, errorCode: string, summary: string): CommandResult {
  return {
    status: "rejected",
    operationId: command.operationId,
    documentVersion: version,
    objectIds: [],
    eventIds: [],
    summary,
    retryable: false,
    errorCode,
  };
}

function validText(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function validFrameValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= -10_000 && value <= 10_000;
}

function normalizeFrame(placement: Partial<Frame> | undefined): Frame | null {
  const frame: Frame = {
    x: placement?.x ?? 350,
    y: placement?.y ?? 208,
    width: placement?.width ?? 570,
    height: placement?.height ?? 365,
  };
  if (![frame.x, frame.y, frame.width, frame.height].every(validFrameValue)) return null;
  if (frame.width < 240 || frame.width > 900 || frame.height < 180 || frame.height > 640) return null;
  return frame;
}

function validFreehandFrame(frame: Frame) {
  return (
    [frame.x, frame.y, frame.width, frame.height].every(validFrameValue) &&
    frame.width >= 48 &&
    frame.width <= 1_000 &&
    frame.height >= 48 &&
    frame.height <= 1_000
  );
}

function validateChart(payload: AddChartPayload): string | null {
  const spec = payload.chartSpec;
  if (!spec || spec.kind !== "bar") return "Only a semantic bar chart is supported.";
  if (!validText(spec.title, 80)) return "Chart title must contain 1–80 characters.";
  if (!Array.isArray(spec.categories) || spec.categories.length < 1 || spec.categories.length > 12) {
    return "Chart requires 1–12 categories.";
  }
  if (!spec.categories.every((value) => validText(value, 24))) return "Category labels must contain 1–24 characters.";
  if (!Array.isArray(spec.values) || spec.values.length !== spec.categories.length) {
    return "Chart values must match the category count.";
  }
  if (!spec.values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100_000)) {
    return "Chart values must be finite numbers between 0 and 100000.";
  }
  if (!COLOR_TOKENS.has(spec.colorToken)) return "Unknown chart color token.";
  if (!normalizeFrame(payload.placement)) return "Chart placement is outside supported bounds.";
  return null;
}

function validateFreehand(payload: AddFreehandPayload): string | null {
  if (!validText(payload.label, 80)) return "Drawing label must contain 1–80 characters.";
  if (!FREEHAND_STROKE_TOKENS.has(payload.strokeToken)) return "Unknown drawing stroke token.";
  if (!Number.isFinite(payload.strokeWidth) || payload.strokeWidth < 1 || payload.strokeWidth > 24) {
    return "Drawing stroke width must be between 1 and 24.";
  }
  if (!payload.placement || !validFreehandFrame(payload.placement)) {
    return "Drawing placement is outside supported bounds.";
  }
  if (!Array.isArray(payload.points) || payload.points.length < 8 || payload.points.length > 256) {
    return "Drawing requires 8–256 points.";
  }
  for (const point of payload.points) {
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.x > payload.placement.width ||
      point.y < 0 ||
      point.y > payload.placement.height ||
      (point.pressure !== undefined &&
        (!Number.isFinite(point.pressure) || point.pressure < 0 || point.pressure > 1))
    ) {
      return "Drawing points must be finite local coordinates inside the placement frame.";
    }
  }
  return null;
}

function validateTable(payload: AddTablePayload): string | null {
  if (!validText(payload.title, 80)) return "Table title must contain 1–80 characters.";
  if (!Array.isArray(payload.columns) || payload.columns.length < 2 || payload.columns.length > 6) {
    return "Table requires 2–6 columns.";
  }
  if (!payload.columns.every((column) => validText(column, 32))) {
    return "Table column labels must contain 1–32 characters.";
  }
  if (!Array.isArray(payload.rows) || payload.rows.length < 1 || payload.rows.length > 12) {
    return "Table requires 1–12 rows.";
  }
  for (const row of payload.rows) {
    if (!Array.isArray(row) || row.length !== payload.columns.length) {
      return "Every table row must match the column count.";
    }
    if (
      row.some(
        (cell) =>
          !(
            (typeof cell === "string" && cell.length <= 80 && !/[\u0000-\u001f\u007f]/.test(cell)) ||
            (typeof cell === "number" && Number.isFinite(cell) && Math.abs(cell) <= 1_000_000_000)
          ),
      )
    ) {
      return "Table cells must be bounded plain text or finite numbers.";
    }
  }
  if (
    !payload.placement ||
    ![payload.placement.x, payload.placement.y, payload.placement.width, payload.placement.height].every(validFrameValue) ||
    payload.placement.width < 240 ||
    payload.placement.width > 1_000 ||
    payload.placement.height < 120 ||
    payload.placement.height > 720
  ) {
    return "Table placement is outside supported bounds.";
  }
  return null;
}

function validateChanges(payload: UpdateObjectPayload): string | null {
  if (!OBJECT_ID.test(payload.objectId)) return "Invalid object ID.";
  const keys = Object.keys(payload.changes);
  if (keys.length === 0) return "At least one allowlisted change is required.";
  if (keys.some((key) => !["title", "colorToken", "hidden", "locked", "rotation", "frame"].includes(key))) {
    return "Update contains a protected or unknown field.";
  }
  if (payload.changes.title !== undefined && !validText(payload.changes.title, 80)) {
    return "Title must contain 1–80 characters.";
  }
  if (payload.changes.colorToken !== undefined && !COLOR_TOKENS.has(payload.changes.colorToken)) {
    return "Unknown chart color token.";
  }
  if (payload.changes.hidden !== undefined && typeof payload.changes.hidden !== "boolean") {
    return "Hidden must be boolean.";
  }
  if (payload.changes.locked !== undefined && typeof payload.changes.locked !== "boolean") {
    return "Locked must be boolean.";
  }
  if (
    payload.changes.rotation !== undefined &&
    (typeof payload.changes.rotation !== "number" ||
      !Number.isFinite(payload.changes.rotation) ||
      payload.changes.rotation < -360 ||
      payload.changes.rotation > 360)
  ) {
    return "Rotation must be a finite angle between -360 and 360 degrees.";
  }
  if (payload.changes.frame !== undefined) {
    const frame = payload.changes.frame as Record<string, unknown>;
    if (
      typeof frame !== "object" ||
      frame === null ||
      Array.isArray(frame) ||
      Object.keys(frame).length === 0 ||
      Object.keys(frame).some((key) => !["x", "y", "width", "height"].includes(key)) ||
      Object.values(frame).some((value) => !validFrameValue(value)) ||
      (frame.width !== undefined && (Number(frame.width) < 24 || Number(frame.width) > 1_000)) ||
      (frame.height !== undefined && (Number(frame.height) < 24 || Number(frame.height) > 1_000))
    ) {
      return "Frame must contain only bounded finite position or positive size values.";
    }
  }
  return null;
}

function validateMergedFrame(object: SceneObject, frame: Frame): string | null {
  if (![frame.x, frame.y, frame.width, frame.height].every(validFrameValue)) {
    return "Frame is outside supported bounds.";
  }
  if (frame.width < 24 || frame.width > 1_000 || frame.height < 24 || frame.height > 1_000) {
    return "Frame size is outside supported bounds.";
  }
  if (object.type === "chart" && (frame.width < 240 || frame.height < 180)) {
    return "Chart frame must be at least 240 by 180.";
  }
  if (object.type === "table" && (frame.width < 240 || frame.height < 120 || frame.height > 720)) {
    return "Table frame must be between 240×120 and 1000×720.";
  }
  return null;
}

export class CommandGateway {
  private document: CanvasDocument;
  private readonly makeId: NonNullable<GatewayDependencies["makeId"]>;
  private readonly now: NonNullable<GatewayDependencies["now"]>;

  constructor(
    initialDocument: CanvasDocument,
    private readonly repository: SceneRepository,
    dependencies: GatewayDependencies = {},
  ) {
    this.document = structuredClone(initialDocument);
    this.makeId = dependencies.makeId ?? defaultMakeId;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  getSnapshot() {
    return structuredClone(this.document);
  }

  getObject(objectId: string) {
    const object = this.document.objects[objectId];
    return object ? structuredClone(object) : null;
  }

  getSceneSummary(selectedObjectIds: string[] = []): SceneSummary {
    const objects = this.document.rootObjectIds
      .map((id) => this.document.objects[id])
      .filter((object): object is SceneObject => Boolean(object) && !object.hidden);

    const objectCounts: SceneSummary["objectCounts"] = { chart: 0, text: 0, annotation: 0, freehand: 0, table: 0 };
    for (const object of objects) objectCounts[object.type] += 1;

    return {
      documentId: this.document.id,
      title: this.document.title,
      documentVersion: this.document.documentVersion,
      objectCount: objects.length,
      objectCounts,
      objects: objects.slice(0, 24).map((object) => ({
        id: object.id,
        type: object.type,
        label: objectLabel(object).slice(0, 80),
        bounds: object.frame,
      })),
      selectedObjectIds: selectedObjectIds.filter((id) => Boolean(this.document.objects[id])).slice(0, 8),
    };
  }

  execute(command: CanvasCommand, actor: ActorRef): CommandResult {
    const original = this.document.operationResults[command.operationId];
    if (original) {
      return {
        ...structuredClone(original),
        status: "duplicate",
        summary: `Duplicate call; original result: ${original.summary}`,
      };
    }

    if (!OPERATION_ID.test(command.operationId) || !validText(command.correlationId, 96)) {
      return rejected(command, this.document.documentVersion, "INVALID_ENVELOPE", "Invalid operation envelope.");
    }

    if (
      !Number.isInteger(command.expectedDocumentVersion) ||
      command.expectedDocumentVersion !== this.document.documentVersion
    ) {
      return {
        status: "conflict",
        operationId: command.operationId,
        documentVersion: this.document.documentVersion,
        currentDocumentVersion: this.document.documentVersion,
        objectIds: [],
        eventIds: [],
        summary: `Version conflict. Current document version is ${this.document.documentVersion}.`,
        retryable: false,
        errorCode: "VERSION_CONFLICT",
      };
    }

    if (command.commandType === "AddChart") return this.addChart(command, actor);
    if (command.commandType === "AddFreehand") return this.addFreehand(command, actor);
    if (command.commandType === "AddTable") return this.addTable(command, actor);
    if (command.commandType === "UpdateObject") return this.updateObject(command, actor);
    return this.undo(command, actor);
  }

  private addChart(command: Extract<CanvasCommand, { commandType: "AddChart" }>, actor: ActorRef) {
    const validationError = validateChart(command.payload);
    if (validationError) return rejected(command, this.document.documentVersion, "INVALID_CHART", validationError);
    const frame = normalizeFrame(command.payload.placement)!;
    const now = this.now();
    const objectId = this.makeId("obj");
    const eventId = this.makeId("evt");
    const provenance: Provenance = {
      source: actor.actorType === "human" ? "human" : "tool",
      operationId: command.operationId,
      ...(actor.actorType === "external_agent" ? { toolName: "add_chart" as const } : {}),
    };
    const object: ChartObject = {
      id: objectId,
      type: "chart",
      parentId: null,
      zIndex: `${this.document.rootObjectIds.length + 1}`.padStart(4, "0"),
      frame,
      hidden: false,
      locked: false,
      properties: structuredClone(command.payload.chartSpec),
      createdBy: actor,
      updatedBy: actor,
      provenance,
      createdAt: now,
      updatedAt: now,
      lastOperationId: command.operationId,
    };
    const event: DomainEvent = {
      eventId,
      sequence: this.document.lastEventSequence + 1,
      documentVersion: this.document.documentVersion + 1,
      operationId: command.operationId,
      correlationId: command.correlationId,
      eventType: "ObjectAdded",
      objectIds: [objectId],
      actor,
      provenance,
      occurredAt: now,
      after: object,
    };
    const result: CommandResult = {
      status: "applied",
      operationId: command.operationId,
      documentVersion: event.documentVersion,
      objectIds: [objectId],
      eventIds: [eventId],
      summary: `Added chart “${object.properties.title}”.`,
      retryable: false,
    };
    return this.commit(event, result, (next) => {
      next.rootObjectIds.push(objectId);
      next.objects[objectId] = object;
    });
  }

  private addFreehand(command: Extract<CanvasCommand, { commandType: "AddFreehand" }>, actor: ActorRef) {
    const validationError = validateFreehand(command.payload);
    if (validationError) {
      return rejected(command, this.document.documentVersion, "INVALID_FREEHAND", validationError);
    }
    const now = this.now();
    const objectId = this.makeId("obj");
    const eventId = this.makeId("evt");
    const provenance: Provenance = {
      source: actor.actorType === "human" ? "human" : "tool",
      operationId: command.operationId,
      ...(actor.actorType === "external_agent" ? { toolName: "add_freehand" as const } : {}),
    };
    const object: FreehandObject = {
      id: objectId,
      type: "freehand",
      parentId: null,
      zIndex: `${this.document.rootObjectIds.length + 1}`.padStart(4, "0"),
      frame: structuredClone(command.payload.placement),
      hidden: false,
      locked: false,
      properties: {
        label: command.payload.label.trim(),
        points: structuredClone(command.payload.points),
        sourceWidth: command.payload.placement.width,
        sourceHeight: command.payload.placement.height,
        strokeToken: command.payload.strokeToken,
        strokeWidth: command.payload.strokeWidth,
        closed: true,
      },
      createdBy: actor,
      updatedBy: actor,
      provenance,
      createdAt: now,
      updatedAt: now,
      lastOperationId: command.operationId,
    };
    const event: DomainEvent = {
      eventId,
      sequence: this.document.lastEventSequence + 1,
      documentVersion: this.document.documentVersion + 1,
      operationId: command.operationId,
      correlationId: command.correlationId,
      eventType: "ObjectAdded",
      objectIds: [objectId],
      actor,
      provenance,
      occurredAt: now,
      after: object,
    };
    const result: CommandResult = {
      status: "applied",
      operationId: command.operationId,
      documentVersion: event.documentVersion,
      objectIds: [objectId],
      eventIds: [eventId],
      summary: `Added drawing “${object.properties.label}”.`,
      retryable: false,
    };
    return this.commit(event, result, (next) => {
      next.rootObjectIds.push(objectId);
      next.objects[objectId] = object;
    });
  }

  private addTable(command: Extract<CanvasCommand, { commandType: "AddTable" }>, actor: ActorRef) {
    const validationError = validateTable(command.payload);
    if (validationError) return rejected(command, this.document.documentVersion, "INVALID_TABLE", validationError);
    const now = this.now();
    const objectId = this.makeId("obj");
    const eventId = this.makeId("evt");
    const provenance: Provenance = {
      source: actor.actorType === "human" ? "human" : "tool",
      operationId: command.operationId,
      ...(actor.actorType === "external_agent" ? { toolName: "add_table" as const } : {}),
    };
    const object: TableObject = {
      id: objectId,
      type: "table",
      parentId: null,
      zIndex: `${this.document.rootObjectIds.length + 1}`.padStart(4, "0"),
      frame: structuredClone(command.payload.placement),
      hidden: false,
      locked: false,
      properties: {
        title: command.payload.title.trim(),
        columns: structuredClone(command.payload.columns),
        rows: structuredClone(command.payload.rows),
      },
      createdBy: actor,
      updatedBy: actor,
      provenance,
      createdAt: now,
      updatedAt: now,
      lastOperationId: command.operationId,
    };
    const event: DomainEvent = {
      eventId,
      sequence: this.document.lastEventSequence + 1,
      documentVersion: this.document.documentVersion + 1,
      operationId: command.operationId,
      correlationId: command.correlationId,
      eventType: "ObjectAdded",
      objectIds: [objectId],
      actor,
      provenance,
      occurredAt: now,
      after: object,
    };
    const result: CommandResult = {
      status: "applied",
      operationId: command.operationId,
      documentVersion: event.documentVersion,
      objectIds: [objectId],
      eventIds: [eventId],
      summary: `Added table “${object.properties.title}”.`,
      retryable: false,
    };
    return this.commit(event, result, (next) => {
      next.rootObjectIds.push(objectId);
      next.objects[objectId] = object;
    });
  }

  private updateObject(command: Extract<CanvasCommand, { commandType: "UpdateObject" }>, actor: ActorRef) {
    const validationError = validateChanges(command.payload);
    if (validationError) return rejected(command, this.document.documentVersion, "INVALID_UPDATE", validationError);
    const object = this.document.objects[command.payload.objectId];
    if (!object) return rejected(command, this.document.documentVersion, "OBJECT_NOT_FOUND", "Object not found.");
    if (object.locked && command.payload.changes.locked !== false) {
      return rejected(command, this.document.documentVersion, "OBJECT_LOCKED", "Unlock the object before editing it.");
    }
    if (command.payload.changes.colorToken !== undefined && object.type !== "chart") {
      return rejected(command, this.document.documentVersion, "TYPE_MISMATCH", "Color tokens are only supported for charts.");
    }
    const mergedFrame = command.payload.changes.frame
      ? { ...object.frame, ...command.payload.changes.frame }
      : object.frame;
    const frameError = validateMergedFrame(object, mergedFrame);
    if (frameError) return rejected(command, this.document.documentVersion, "INVALID_UPDATE", frameError);

    const now = this.now();
    const before = structuredClone(object);
    const after = structuredClone(object);
    const changes = command.payload.changes;
    if (changes.title !== undefined) {
      if (after.type === "chart") after.properties.title = changes.title;
      if (after.type === "text") after.properties.plainText = changes.title;
      if (after.type === "annotation") after.properties.text = changes.title;
      if (after.type === "freehand") after.properties.label = changes.title;
      if (after.type === "table") after.properties.title = changes.title;
    }
    if (changes.colorToken !== undefined && after.type === "chart") after.properties.colorToken = changes.colorToken;
    if (changes.hidden !== undefined) after.hidden = changes.hidden;
    if (changes.locked !== undefined) after.locked = changes.locked;
    if (changes.rotation !== undefined) after.rotation = ((changes.rotation % 360) + 360) % 360;
    if (changes.frame !== undefined) after.frame = mergedFrame;
    after.updatedAt = now;
    after.updatedBy = actor;
    after.lastOperationId = command.operationId;
    after.provenance = {
      source: actor.actorType === "human" ? "human" : "tool",
      operationId: command.operationId,
      ...(actor.actorType === "external_agent" ? { toolName: "update_object" as const } : {}),
    };

    const eventId = this.makeId("evt");
    const event: DomainEvent = {
      eventId,
      sequence: this.document.lastEventSequence + 1,
      documentVersion: this.document.documentVersion + 1,
      operationId: command.operationId,
      correlationId: command.correlationId,
      eventType: "ObjectUpdated",
      objectIds: [after.id],
      actor,
      provenance: after.provenance,
      occurredAt: now,
      before,
      after,
    };
    const result: CommandResult = {
      status: "applied",
      operationId: command.operationId,
      documentVersion: event.documentVersion,
      objectIds: [after.id],
      eventIds: [eventId],
      summary: `Updated ${after.type} “${objectLabel(after)}”.`,
      retryable: false,
    };
    return this.commit(event, result, (next) => {
      next.objects[after.id] = after;
    });
  }

  private undo(command: Extract<CanvasCommand, { commandType: "Undo" }>, actor: ActorRef) {
    const target = [...this.document.events]
      .reverse()
      .find(
        (event) =>
          (event.eventType === "ObjectAdded" || event.eventType === "ObjectUpdated") &&
          !this.document.undoneOperationIds.includes(event.operationId) &&
          (!command.payload.targetOperationId || command.payload.targetOperationId === event.operationId),
      );
    if (!target) return rejected(command, this.document.documentVersion, "NOTHING_TO_UNDO", "No reversible command found.");

    const now = this.now();
    const eventId = this.makeId("evt");
    const current = target.objectIds[0] ? this.document.objects[target.objectIds[0]] : undefined;
    const restored = target.eventType === "ObjectUpdated" && target.before ? structuredClone(target.before) : undefined;
    if (restored) {
      restored.updatedAt = now;
      restored.updatedBy = actor;
      restored.lastOperationId = command.operationId;
      restored.provenance = {
        source: actor.actorType === "human" ? "human" : "tool",
        operationId: command.operationId,
        ...(actor.actorType === "external_agent" ? { toolName: "undo" as const } : {}),
      };
    }
    const provenance: Provenance = {
      source: actor.actorType === "human" ? "human" : "tool",
      operationId: command.operationId,
      ...(actor.actorType === "external_agent" ? { toolName: "undo" as const } : {}),
    };
    const event: DomainEvent = {
      eventId,
      sequence: this.document.lastEventSequence + 1,
      documentVersion: this.document.documentVersion + 1,
      operationId: command.operationId,
      correlationId: command.correlationId,
      eventType: "CommandUndone",
      objectIds: target.objectIds,
      actor,
      provenance,
      occurredAt: now,
      before: current ? structuredClone(current) : undefined,
      after: restored,
      targetOperationId: target.operationId,
    };
    const result: CommandResult = {
      status: "applied",
      operationId: command.operationId,
      documentVersion: event.documentVersion,
      objectIds: target.objectIds,
      eventIds: [eventId],
      summary: `Undid ${target.eventType === "ObjectAdded" ? "object creation" : "object update"}.`,
      retryable: false,
    };
    return this.commit(event, result, (next) => {
      const objectId = target.objectIds[0];
      if (target.eventType === "ObjectAdded") {
        delete next.objects[objectId];
        next.rootObjectIds = next.rootObjectIds.filter((id) => id !== objectId);
      } else if (restored) {
        next.objects[objectId] = restored;
      }
      next.undoneOperationIds.push(target.operationId);
    });
  }

  private commit(event: DomainEvent, result: CommandResult, mutate: (next: CanvasDocument) => void) {
    const next = structuredClone(this.document);
    mutate(next);
    next.events.push(event);
    next.documentVersion = event.documentVersion;
    next.lastEventSequence = event.sequence;
    next.updatedAt = event.occurredAt;
    next.operationResults[result.operationId] = structuredClone(result);
    this.repository.save(next);
    this.document = next;
    return structuredClone(result);
  }
}
