import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "./fixtures";
import { CommandGateway } from "./gateway";
import { MemorySceneRepository } from "./persistence";
import { AGENT_ACTOR, LOCAL_ACTOR, type CanvasCommand } from "./types";

function createHarness() {
  const initial = createEmptyDocument();
  const repository = new MemorySceneRepository();
  let id = 0;
  const gateway = new CommandGateway(initial, repository, {
    makeId: (prefix) => `${prefix}_test_${++id}`,
    now: () => "2026-09-04T10:00:00.000Z",
  });
  return { gateway, repository };
}

function addChart(expectedDocumentVersion = 1): Extract<CanvasCommand, { commandType: "AddChart" }> {
  return {
    commandType: "AddChart",
    operationId: "op-create",
    correlationId: "corr-create",
    expectedDocumentVersion,
    payload: {
      chartSpec: {
        kind: "bar",
        title: "Sales Q1",
        categories: ["Jan", "Feb", "Mar"],
        values: [10, 14, 9],
        colorToken: "duo",
      },
      placement: { x: 100, y: 100, width: 570, height: 365 },
      selectAfterCreate: true,
    },
  };
}

describe("CommandGateway chart vertical slice", () => {
  it("starts with a canonical empty document at version 1", () => {
    const { gateway } = createHarness();
    const state = gateway.getSnapshot();
    expect(state.documentVersion).toBe(1);
    expect(state.rootObjectIds).toEqual([]);
    expect(state.events).toEqual([]);
  });

  it("adds one chart, updates that stable ID, and undoes with a compensating event", () => {
    const { gateway, repository } = createHarness();

    const added = gateway.execute(addChart(), AGENT_ACTOR);
    expect(added.status).toBe("applied");
    expect(added.documentVersion).toBe(2);
    expect(added.objectIds).toHaveLength(1);
    expect(added.eventIds).toHaveLength(1);
    const chartId = added.objectIds[0];
    const afterAdd = gateway.getSnapshot();
    expect(afterAdd.rootObjectIds).toEqual([chartId]);
    expect(afterAdd.events).toHaveLength(1);
    expect(afterAdd.objects[chartId]?.type).toBe("chart");

    const updated = gateway.execute(
      {
        commandType: "UpdateObject",
        operationId: "op-update",
        correlationId: "corr-update",
        expectedDocumentVersion: 2,
        payload: {
          objectId: chartId,
          changes: { title: "Revenue Q1", colorToken: "green", rotation: 45 },
        },
      },
      AGENT_ACTOR,
    );
    expect(updated.status).toBe("applied");
    expect(updated.documentVersion).toBe(3);
    expect(updated.objectIds).toEqual([chartId]);
    expect(gateway.getSnapshot().rootObjectIds).toEqual([chartId]);
    const changedChart = gateway.getObject(chartId);
    expect(changedChart?.type).toBe("chart");
    if (changedChart?.type === "chart") {
      expect(changedChart.properties.title).toBe("Revenue Q1");
      expect(changedChart.properties.colorToken).toBe("green");
      expect(changedChart.rotation).toBe(45);
      expect(changedChart.provenance.toolName).toBe("update_object");
    }

    const undone = gateway.execute(
      {
        commandType: "Undo",
        operationId: "op-undo",
        correlationId: "corr-undo",
        expectedDocumentVersion: 3,
        payload: {},
      },
      LOCAL_ACTOR,
    );
    expect(undone.status).toBe("applied");
    expect(undone.documentVersion).toBe(4);
    expect(undone.objectIds).toEqual([chartId]);
    const afterUndo = gateway.getSnapshot();
    expect(afterUndo.events).toHaveLength(3);
    expect(afterUndo.events.at(-1)?.eventType).toBe("CommandUndone");
    expect(afterUndo.events.at(-1)?.targetOperationId).toBe("op-update");
    const restoredChart = afterUndo.objects[chartId];
    expect(restoredChart.type).toBe("chart");
    if (restoredChart.type === "chart") {
      expect(restoredChart.properties.title).toBe("Sales Q1");
      expect(restoredChart.properties.colorToken).toBe("duo");
      expect(restoredChart.rotation).toBeUndefined();
    }

    const reloaded = new CommandGateway(repository.load()!, new MemorySceneRepository()).getSnapshot();
    expect(reloaded).toEqual(afterUndo);
  });

  it("returns the original IDs for a duplicate operation without a second side effect", () => {
    const { gateway } = createHarness();
    const first = gateway.execute(addChart(), AGENT_ACTOR);
    const duplicate = gateway.execute(addChart(1), AGENT_ACTOR);

    expect(duplicate.status).toBe("duplicate");
    expect(duplicate.objectIds).toEqual(first.objectIds);
    expect(duplicate.eventIds).toEqual(first.eventIds);
    expect(duplicate.documentVersion).toBe(2);
    expect(gateway.getSnapshot().rootObjectIds).toHaveLength(1);
    expect(gateway.getSnapshot().events).toHaveLength(1);
  });

  it("returns a conflict for a stale expected version and does not mutate", () => {
    const { gateway } = createHarness();
    gateway.execute(addChart(), AGENT_ACTOR);
    const before = gateway.getSnapshot();
    const chartId = before.rootObjectIds[0];

    const conflict = gateway.execute(
      {
        commandType: "UpdateObject",
        operationId: "op-stale",
        correlationId: "corr-stale",
        expectedDocumentVersion: 1,
        payload: { objectId: chartId, changes: { colorToken: "green" } },
      },
      AGENT_ACTOR,
    );

    expect(conflict.status).toBe("conflict");
    expect(conflict.currentDocumentVersion).toBe(2);
    expect(gateway.getSnapshot()).toEqual(before);
  });

  it("moves and resizes one exact chart with a bounded frame patch", () => {
    const { gateway } = createHarness();
    const added = gateway.execute(addChart(), AGENT_ACTOR);
    const chartId = added.objectIds[0];

    const moved = gateway.execute(
      {
        commandType: "UpdateObject",
        operationId: "op-move-chart",
        correlationId: "corr-move-chart",
        expectedDocumentVersion: 2,
        payload: { objectId: chartId, changes: { frame: { x: 100, width: 440 } } },
      },
      AGENT_ACTOR,
    );

    expect(moved).toMatchObject({ status: "applied", documentVersion: 3, objectIds: [chartId] });
    expect(gateway.getObject(chartId)?.frame).toEqual({ x: 100, y: 100, width: 440, height: 365 });

    const beforeInvalid = gateway.getSnapshot();
    const invalid = gateway.execute(
      {
        commandType: "UpdateObject",
        operationId: "op-invalid-frame",
        correlationId: "corr-invalid-frame",
        expectedDocumentVersion: 3,
        payload: { objectId: chartId, changes: { frame: { width: -1 } } },
      },
      AGENT_ACTOR,
    );
    expect(invalid).toMatchObject({ status: "rejected", errorCode: "INVALID_UPDATE" });
    expect(gateway.getSnapshot()).toEqual(beforeInvalid);
  });
});

describe("CommandGateway freehand slice", () => {
  it("adds one stable drawing and preserves idempotency and optimistic concurrency", () => {
    const { gateway } = createHarness();
    const command: Extract<CanvasCommand, { commandType: "AddFreehand" }> = {
      commandType: "AddFreehand",
      operationId: "op-add-freehand",
      correlationId: "corr-add-freehand",
      expectedDocumentVersion: 1,
      payload: {
        label: "Hand-drawn circle",
        points: [
          { x: 100, y: 10 }, { x: 164, y: 36 }, { x: 190, y: 100 }, { x: 164, y: 164 },
          { x: 100, y: 190 }, { x: 36, y: 164 }, { x: 10, y: 100 }, { x: 36, y: 36 },
        ],
        strokeToken: "coral",
        strokeWidth: 6,
        placement: { x: 420, y: 240, width: 200, height: 200 },
        selectAfterCreate: true,
      },
    };

    const added = gateway.execute(command, AGENT_ACTOR);
    expect(added).toMatchObject({ status: "applied", documentVersion: 2 });
    expect(added.objectIds).toHaveLength(1);
    const drawingId = added.objectIds[0];
    const drawing = gateway.getObject(drawingId);
    expect(drawing).toMatchObject({
      id: drawingId,
      type: "freehand",
      properties: {
        label: "Hand-drawn circle",
        sourceWidth: 200,
        sourceHeight: 200,
        strokeToken: "coral",
        strokeWidth: 6,
        closed: true,
      },
      provenance: { toolName: "add_freehand" },
    });
    expect(gateway.getSceneSummary().objectCounts.freehand).toBe(1);

    const stretched = gateway.execute(
      {
        commandType: "UpdateObject",
        operationId: "op-stretch-freehand",
        correlationId: "corr-stretch-freehand",
        expectedDocumentVersion: 2,
        payload: { objectId: drawingId, changes: { frame: { width: 300, height: 120 } } },
      },
      LOCAL_ACTOR,
    );
    expect(stretched).toMatchObject({ status: "applied", documentVersion: 3 });
    expect(gateway.getObject(drawingId)?.frame).toMatchObject({ width: 300, height: 120 });

    const duplicate = gateway.execute(command, AGENT_ACTOR);
    expect(duplicate).toMatchObject({ status: "duplicate", objectIds: [drawingId], documentVersion: 2 });
    expect(gateway.getSnapshot().events).toHaveLength(2);

    const beforeConflict = gateway.getSnapshot();
    const conflict = gateway.execute(
      { ...command, operationId: "op-stale-freehand", expectedDocumentVersion: 1 },
      AGENT_ACTOR,
    );
    expect(conflict).toMatchObject({ status: "conflict", currentDocumentVersion: 3 });
    expect(gateway.getSnapshot()).toEqual(beforeConflict);
  });
});

describe("CommandGateway table slice", () => {
  it("adds one semantic table idempotently and removes it through compensating undo", () => {
    const { gateway } = createHarness();
    const command: Extract<CanvasCommand, { commandType: "AddTable" }> = {
      commandType: "AddTable",
      operationId: "op-add-table",
      correlationId: "corr-add-table",
      expectedDocumentVersion: 1,
      payload: {
        title: "Nutrition",
        columns: ["Nutrient", "Amount"],
        rows: [["Protein", 24], ["Fiber", "8 g"]],
        placement: { x: 320, y: 220, width: 460, height: 240 },
        selectAfterCreate: true,
      },
    };

    const added = gateway.execute(command, AGENT_ACTOR);
    const tableId = added.objectIds[0];
    expect(added).toMatchObject({ status: "applied", documentVersion: 2 });
    expect(gateway.getObject(tableId)).toMatchObject({
      id: tableId,
      type: "table",
      properties: { title: "Nutrition", columns: ["Nutrient", "Amount"] },
      provenance: { toolName: "add_table" },
    });
    expect(gateway.getSceneSummary().objectCounts.table).toBe(1);

    const duplicate = gateway.execute(command, AGENT_ACTOR);
    expect(duplicate).toMatchObject({ status: "duplicate", objectIds: [tableId], documentVersion: 2 });
    expect(gateway.getSnapshot().events).toHaveLength(1);

    const undone = gateway.execute(
      {
        commandType: "Undo",
        operationId: "op-undo-table",
        correlationId: "corr-undo-table",
        expectedDocumentVersion: 2,
        payload: {},
      },
      LOCAL_ACTOR,
    );
    expect(undone).toMatchObject({ status: "applied", documentVersion: 3, objectIds: [tableId] });
    expect(gateway.getObject(tableId)).toBeNull();
    expect(gateway.getSnapshot().events.at(-1)?.targetOperationId).toBe("op-add-table");
  });
});
