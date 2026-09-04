import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@/domain/fixtures";
import { CommandGateway } from "@/domain/gateway";
import { MemorySceneRepository } from "@/domain/persistence";
import type { CanvasDocument } from "@/domain/types";
import { registerWebMcpTools, type ModelContext } from "./register";
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

function assertStrictObjects(schema: unknown) {
  if (!schema || typeof schema !== "object") return;
  const record = schema as Record<string, unknown>;
  if (record.type === "object") expect(record.additionalProperties).toBe(false);
  for (const value of Object.values(record)) assertStrictObjects(value);
}

describe("WebMCP registration", () => {
  it("keeps every object schema closed to unknown fields", () => {
    for (const schema of [
      getSceneSummaryInputSchema,
      getObjectInputSchema,
      setCanvasViewInputSchema,
      setCanvasViewportInputSchema,
      addChartInputSchema,
      addFreehandInputSchema,
      addTableInputSchema,
      updateObjectInputSchema,
      undoInputSchema,
    ]) {
      assertStrictObjects(schema);
    }
  });

  it("returns an unsupported fallback without mutating or registering tools", async () => {
    const gateway = new CommandGateway(createEmptyDocument(), new MemorySceneRepository());
    const result = await registerWebMcpTools({
      gateway,
      context: { requireCurrent: () => ({ document: gateway.getSnapshot(), selectedObjectIds: [] }) },
      isTopLevel: true,
    });
    expect(result).toEqual({ status: "unavailable", registeredTools: [], reason: "unsupported" });
    expect(gateway.getSnapshot().documentVersion).toBe(1);
  });

  it("registers the nine narrow tools and reads current context at execute time", async () => {
    const definitions = new Map<string, Parameters<ModelContext["registerTool"]>[0]>();
    const modelContext: ModelContext = {
      registerTool(definition) {
        definitions.set(definition.name, definition);
      },
    };
    const gateway = new CommandGateway(createEmptyDocument(), new MemorySceneRepository());
    let currentDocument: CanvasDocument = gateway.getSnapshot();
    let contextReads = 0;
    let canvasView: "canvas_only" | "standard" = "standard";
    let viewportRequest: unknown;
    const registration = await registerWebMcpTools({
      gateway,
      modelContext,
      isTopLevel: true,
      context: {
        requireCurrent: () => {
          contextReads += 1;
          return { document: currentDocument, selectedObjectIds: [] };
        },
      },
      onCanvasViewChange: (mode) => {
        canvasView = mode;
      },
      onCanvasViewportChange: (request) => {
        viewportRequest = request;
        return { status: "applied", viewport: request };
      },
    });

    expect(registration.status).toBe("ready");
    expect([...definitions.keys()]).toEqual([
      "get_scene_summary",
      "get_object",
      "add_chart",
      "add_freehand",
      "add_table",
      "update_object",
      "undo",
      "set_canvas_view",
      "set_canvas_viewport",
    ]);
    expect(definitions.get("get_scene_summary")?.annotations).toEqual({ readOnlyHint: true });

    const addResult = await definitions.get("add_chart")!.execute({
      operationId: "web-add-chart",
      expectedDocumentVersion: 1,
      chartSpec: {
        kind: "bar",
        title: "Sales Q1",
        categories: ["Jan", "Feb", "Mar"],
        values: [10, 14, 9],
        colorToken: "duo",
      },
    });
    expect(addResult).toMatchObject({ status: "applied", documentVersion: 2 });
    currentDocument = gateway.getSnapshot();

    const summary = await definitions.get("get_scene_summary")!.execute({
      detail: "compact",
      includeRecentChanges: true,
    });
    expect(summary).toMatchObject({ documentVersion: 2, objectCount: 1 });
    expect(contextReads).toBe(2);

    const beforeViewChange = gateway.getSnapshot();
    const viewResult = await definitions.get("set_canvas_view")!.execute({ mode: "canvas_only" });
    expect(viewResult).toMatchObject({ status: "applied", mode: "canvas_only" });
    expect(canvasView).toBe("canvas_only");
    expect(gateway.getSnapshot()).toEqual(beforeViewChange);

    const viewportResult = await definitions.get("set_canvas_viewport")!.execute({ zoom: 75, panX: 12 });
    expect(viewportResult).toMatchObject({ status: "applied" });
    expect(viewportRequest).toEqual({ zoom: 75, panX: 12 });
    expect(gateway.getSnapshot()).toEqual(beforeViewChange);

    const invalidViewport = await definitions.get("set_canvas_viewport")!.execute({ fit: true });
    expect(invalidViewport).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });

    const invalidView = await definitions.get("set_canvas_view")!.execute({
      mode: "standard",
      arbitrary: true,
    });
    expect(invalidView).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });
    expect(canvasView).toBe("canvas_only");

    const chartId = gateway.getSnapshot().rootObjectIds[0];
    const moved = await definitions.get("update_object")!.execute({
      operationId: "web-move-chart",
      expectedDocumentVersion: 2,
      objectId: chartId,
      changes: { frame: { x: 100, width: 440 }, rotation: 45 },
    });
    expect(moved).toMatchObject({ status: "applied", documentVersion: 3 });
    currentDocument = gateway.getSnapshot();
    expect(gateway.getObject(chartId)?.frame).toMatchObject({ x: 100, width: 440 });
    expect(gateway.getObject(chartId)?.rotation).toBe(45);

    const rejectedRotation = await definitions.get("update_object")!.execute({
      operationId: "web-unsafe-rotation",
      expectedDocumentVersion: 3,
      objectId: chartId,
      changes: { rotation: 721 },
    });
    expect(rejectedRotation).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });

    const rejectedFrame = await definitions.get("update_object")!.execute({
      operationId: "web-unsafe-frame",
      expectedDocumentVersion: 3,
      objectId: chartId,
      changes: { frame: { x: 90, script: "moveAnything()" } },
    });
    expect(rejectedFrame).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });

    const rejectedPath = await definitions.get("add_freehand")!.execute({
      operationId: "web-unsafe-path",
      expectedDocumentVersion: 3,
      label: "Unsafe path",
      points: Array.from({ length: 8 }, (_, index) => ({ x: index * 10, y: index * 10 })),
      strokeToken: "coral",
      strokeWidth: 6,
      placement: { x: 400, y: 200, width: 200, height: 200 },
      path: "M0 0 arbitrary",
    });
    expect(rejectedPath).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });
    expect(gateway.getSnapshot().documentVersion).toBe(3);

    const addedDrawing = await definitions.get("add_freehand")!.execute({
      operationId: "web-add-freehand",
      expectedDocumentVersion: 3,
      label: "Hand-drawn circle",
      points: [
        { x: 100, y: 10 }, { x: 164, y: 36 }, { x: 190, y: 100 }, { x: 164, y: 164 },
        { x: 100, y: 190 }, { x: 36, y: 164 }, { x: 10, y: 100 }, { x: 36, y: 36 },
      ],
      strokeToken: "ink",
      strokeWidth: 5,
      placement: { x: 420, y: 240, width: 200, height: 200 },
      selectAfterCreate: true,
    });
    expect(addedDrawing).toMatchObject({ status: "applied", documentVersion: 4 });
    currentDocument = gateway.getSnapshot();
    expect(gateway.getSceneSummary().objectCounts.freehand).toBe(1);
    expect(canvasView).toBe("canvas_only");

    const rejectedTable = await definitions.get("add_table")!.execute({
      operationId: "web-unsafe-table",
      expectedDocumentVersion: 4,
      title: "Unsafe",
      columns: ["Item", "Value"],
      rows: [["Protein", { html: "<b>24</b>" }]],
      placement: { x: 320, y: 220, width: 460, height: 240 },
    });
    expect(rejectedTable).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });

    const addedTable = await definitions.get("add_table")!.execute({
      operationId: "web-add-table",
      expectedDocumentVersion: 4,
      title: "Nutrition",
      columns: ["Nutrient", "Amount"],
      rows: [["Protein", 24], ["Fiber", "8 g"]],
      placement: { x: 320, y: 220, width: 460, height: 240 },
      selectAfterCreate: true,
    });
    expect(addedTable).toMatchObject({ status: "applied", documentVersion: 5 });
    currentDocument = gateway.getSnapshot();
    expect(gateway.getSceneSummary().objectCounts.table).toBe(1);
    expect(canvasView).toBe("canvas_only");

    const beforeUnknownInput = gateway.getSnapshot();
    const rejected = await definitions.get("add_chart")!.execute({
      operationId: "web-unknown-field",
      expectedDocumentVersion: 5,
      chartSpec: {
        kind: "bar",
        title: "Unsafe",
        categories: ["Jan"],
        values: [1],
        colorToken: "duo",
        option: { formatter: "arbitrary" },
      },
    });
    expect(rejected).toMatchObject({ status: "rejected", errorCode: "INVALID_TOOL_INPUT" });
    expect(gateway.getSnapshot()).toEqual(beforeUnknownInput);
  });

  it("absorbs HMR duplicate registration rejections while adding a new tool", async () => {
    const registeredNames: string[] = [];
    const modelContext: ModelContext = {
      registerTool(definition) {
        if (definition.name !== "add_freehand") return Promise.reject({});
        registeredNames.push(definition.name);
      },
    };
    const gateway = new CommandGateway(createEmptyDocument(), new MemorySceneRepository());
    const result = await registerWebMcpTools({
      gateway,
      modelContext,
      isTopLevel: true,
      context: { requireCurrent: () => ({ document: gateway.getSnapshot(), selectedObjectIds: [] }) },
    });

    expect(result).toMatchObject({ status: "ready" });
    expect(registeredNames).toEqual(["add_freehand"]);
    await expect(
      registerWebMcpTools({
        gateway,
        modelContext,
        isTopLevel: true,
        context: { requireCurrent: () => ({ document: gateway.getSnapshot(), selectedObjectIds: [] }) },
      }),
    ).resolves.toMatchObject({ status: "ready" });
  });
});
