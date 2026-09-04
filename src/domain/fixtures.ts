import type {
  ActorRef,
  AnnotationObject,
  CanvasDocument,
  ChartObject,
  DomainEvent,
  TextObject,
} from "./types";
import { AGENT_ACTOR, LOCAL_ACTOR } from "./types";

const CREATED_AT = "2026-09-04T08:24:00.000Z";

export function createEmptyDocument(): CanvasDocument {
  return {
    id: "doc_q1_planning",
    title: "Q1 Planning",
    schemaVersion: 1,
    documentVersion: 1,
    rootObjectIds: [],
    objects: {},
    events: [],
    operationResults: {},
    undoneOperationIds: [],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    createdBy: LOCAL_ACTOR,
    lastEventSequence: 0,
  };
}

function baseObject(
  id: string,
  zIndex: string,
  frame: { x: number; y: number; width: number; height: number },
  actor: ActorRef,
  operationId: string,
) {
  return {
    id,
    parentId: null,
    zIndex,
    frame,
    hidden: false,
    locked: false,
    createdBy: actor,
    updatedBy: actor,
    provenance: {
      source: "tool" as const,
      operationId,
      toolName: "add_chart" as const,
      attribution: "Created in this canvas",
    },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    lastOperationId: operationId,
  };
}

export function createDemoDocument(): CanvasDocument {
  const chart: ChartObject = {
    ...baseObject(
      "obj_chart_sales_q1",
      "b",
      { x: 385, y: 208, width: 570, height: 365 },
      AGENT_ACTOR,
      "demo-add-scene",
    ),
    type: "chart",
    properties: {
      kind: "bar",
      title: "Sales Q1",
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
      values: [45, 60, 77, 55, 89, 71, 110, 84],
      colorToken: "duo",
    },
  };

  const title: TextObject = {
    ...baseObject(
      "obj_title_sales_q1",
      "a",
      { x: 205, y: 92, width: 220, height: 64 },
      LOCAL_ACTOR,
      "demo-add-scene",
    ),
    type: "text",
    properties: { plainText: "Sales Q1" },
  };

  const annotation: AnnotationObject = {
    ...baseObject(
      "obj_annotation_growth",
      "c",
      { x: 900, y: 622, width: 158, height: 64 },
      AGENT_ACTOR,
      "demo-add-scene",
    ),
    type: "annotation",
    properties: {
      text: "Strong growth in May and July.",
      targetObjectIds: [chart.id],
    },
  };

  const seedEvent: DomainEvent = {
    eventId: "evt_demo_seed",
    sequence: 1,
    documentVersion: 2,
    operationId: "demo-add-scene",
    correlationId: "demo-correlation-1",
    eventType: "SceneSeeded",
    objectIds: [chart.id, title.id, annotation.id],
    actor: LOCAL_ACTOR,
    provenance: { source: "import", operationId: "demo-add-scene" },
    occurredAt: CREATED_AT,
  };

  const updateEvent: DomainEvent = {
    eventId: "evt_demo_update",
    sequence: 2,
    documentVersion: 3,
    operationId: "demo-update-chart",
    correlationId: "demo-correlation-2",
    eventType: "ObjectUpdated",
    objectIds: [chart.id],
    actor: AGENT_ACTOR,
    provenance: {
      source: "tool",
      operationId: "demo-update-chart",
      toolName: "update_object",
    },
    occurredAt: CREATED_AT,
    before: chart,
    after: { ...chart, properties: { ...chart.properties, colorToken: "green" } },
  };

  const undoEvent: DomainEvent = {
    eventId: "evt_demo_undo",
    sequence: 3,
    documentVersion: 4,
    operationId: "demo-undo-update",
    correlationId: "demo-correlation-3",
    eventType: "CommandUndone",
    objectIds: [chart.id],
    actor: LOCAL_ACTOR,
    provenance: { source: "human", operationId: "demo-undo-update" },
    occurredAt: CREATED_AT,
    before: updateEvent.after,
    after: chart,
    targetOperationId: "demo-update-chart",
  };

  return {
    ...createEmptyDocument(),
    documentVersion: 4,
    rootObjectIds: [title.id, chart.id, annotation.id],
    objects: {
      [chart.id]: chart,
      [title.id]: title,
      [annotation.id]: annotation,
    },
    events: [seedEvent, updateEvent, undoEvent],
    undoneOperationIds: ["demo-update-chart"],
    updatedAt: CREATED_AT,
    lastEventSequence: 3,
  };
}
