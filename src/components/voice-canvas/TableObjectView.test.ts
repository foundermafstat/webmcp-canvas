import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AGENT_ACTOR, type TableObject } from "@/domain/types";
import { TableObjectView } from "./TableObjectView";

const table: TableObject = {
  id: "obj_test_table",
  type: "table",
  parentId: null,
  zIndex: "0001",
  frame: { x: 100, y: 100, width: 460, height: 240 },
  hidden: false,
  locked: false,
  properties: {
    title: "Nutrition",
    columns: ["Nutrient", "Amount"],
    rows: [["<Protein>", 24]],
  },
  createdBy: AGENT_ACTOR,
  updatedBy: AGENT_ACTOR,
  provenance: { source: "tool", operationId: "op-test-table", toolName: "add_table" },
  createdAt: "2026-09-04T10:00:00.000Z",
  updatedAt: "2026-09-04T10:00:00.000Z",
  lastOperationId: "op-test-table",
};

describe("TableObjectView", () => {
  it("renders real accessible table semantics and escapes scalar text", () => {
    const markup = renderToStaticMarkup(createElement(TableObjectView, { object: table }));

    expect(markup).toContain("<table>");
    expect(markup).toContain("<caption>Nutrition</caption>");
    expect(markup).toContain('scope="col"');
    expect(markup).toContain("&lt;Protein&gt;");
    expect(markup).not.toContain("<Protein>");
  });
});
