export type ActorType = "human" | "external_agent";

export type ActorRef = {
  actorType: ActorType;
  subjectId: string;
  displayLabel: string;
};

export type Provenance = {
  source: "human" | "tool" | "import";
  operationId: string;
  toolName?: "add_chart" | "add_freehand" | "add_table" | "update_object" | "undo";
  attribution?: string;
};

export type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SceneObjectBase = {
  id: string;
  parentId: null;
  zIndex: string;
  frame: Frame;
  rotation?: number;
  hidden: boolean;
  locked: boolean;
  createdBy: ActorRef;
  updatedBy: ActorRef;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
  lastOperationId: string;
};

export type ChartColorToken = "duo" | "coral" | "ink" | "green";

export type ChartObject = SceneObjectBase & {
  type: "chart";
  properties: {
    kind: "bar";
    title: string;
    categories: string[];
    values: number[];
    colorToken: ChartColorToken;
  };
};

export type TextObject = SceneObjectBase & {
  type: "text";
  properties: {
    plainText: string;
  };
};

export type AnnotationObject = SceneObjectBase & {
  type: "annotation";
  properties: {
    text: string;
    targetObjectIds: string[];
  };
};

export type FreehandStrokeToken = "coral" | "ink";

export type FreehandPoint = {
  x: number;
  y: number;
  pressure?: number;
};

export type FreehandObject = SceneObjectBase & {
  type: "freehand";
  properties: {
    label: string;
    points: FreehandPoint[];
    sourceWidth?: number;
    sourceHeight?: number;
    strokeToken: FreehandStrokeToken;
    strokeWidth: number;
    closed: true;
  };
};

export type TableCell = string | number;

export type TableObject = SceneObjectBase & {
  type: "table";
  properties: {
    title: string;
    columns: string[];
    rows: TableCell[][];
  };
};

export type SceneObject = ChartObject | TextObject | AnnotationObject | FreehandObject | TableObject;

export type DomainEvent = {
  eventId: string;
  sequence: number;
  documentVersion: number;
  operationId: string;
  correlationId: string;
  eventType: "ObjectAdded" | "ObjectUpdated" | "CommandUndone" | "SceneSeeded";
  objectIds: string[];
  actor: ActorRef;
  provenance: Provenance;
  occurredAt: string;
  before?: SceneObject;
  after?: SceneObject;
  targetOperationId?: string;
};

export type CommandStatus = "applied" | "duplicate" | "conflict" | "rejected";

export type CommandResult = {
  status: CommandStatus;
  operationId: string;
  documentVersion: number;
  objectIds: string[];
  eventIds: string[];
  summary: string;
  retryable: boolean;
  errorCode?: string;
  currentDocumentVersion?: number;
};

export type CanvasDocument = {
  id: string;
  title: string;
  schemaVersion: 1;
  documentVersion: number;
  rootObjectIds: string[];
  objects: Record<string, SceneObject>;
  events: DomainEvent[];
  operationResults: Record<string, CommandResult>;
  undoneOperationIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: ActorRef;
  lastEventSequence: number;
};

export type AddChartPayload = {
  chartSpec: {
    kind: "bar";
    title: string;
    categories: string[];
    values: number[];
    colorToken: ChartColorToken;
  };
  placement?: Partial<Frame>;
  selectAfterCreate?: boolean;
};

export type AddFreehandPayload = {
  label: string;
  points: FreehandPoint[];
  strokeToken: FreehandStrokeToken;
  strokeWidth: number;
  placement: Frame;
  selectAfterCreate?: boolean;
};

export type AddTablePayload = {
  title: string;
  columns: string[];
  rows: TableCell[][];
  placement: Frame;
  selectAfterCreate?: boolean;
};

export type UpdateObjectPayload = {
  objectId: string;
  changes: {
    title?: string;
    colorToken?: ChartColorToken;
    hidden?: boolean;
    locked?: boolean;
    rotation?: number;
    frame?: Partial<Frame>;
  };
  selectAfterUpdate?: boolean;
};

type WriteEnvelope = {
  operationId: string;
  correlationId: string;
  expectedDocumentVersion: number;
};

export type CanvasCommand =
  | (WriteEnvelope & { commandType: "AddChart"; payload: AddChartPayload })
  | (WriteEnvelope & { commandType: "AddFreehand"; payload: AddFreehandPayload })
  | (WriteEnvelope & { commandType: "AddTable"; payload: AddTablePayload })
  | (WriteEnvelope & { commandType: "UpdateObject"; payload: UpdateObjectPayload })
  | (WriteEnvelope & {
      commandType: "Undo";
      payload: { targetOperationId?: string };
    });

export type SceneSummary = {
  documentId: string;
  title: string;
  documentVersion: number;
  objectCount: number;
  objectCounts: Record<SceneObject["type"], number>;
  objects: Array<{
    id: string;
    type: SceneObject["type"];
    label: string;
    bounds: Frame;
  }>;
  selectedObjectIds: string[];
};

export const LOCAL_ACTOR: ActorRef = {
  actorType: "human",
  subjectId: "local-user",
  displayLabel: "You",
};

export const AGENT_ACTOR: ActorRef = {
  actorType: "external_agent",
  subjectId: "page-agent",
  displayLabel: "Agent",
};
