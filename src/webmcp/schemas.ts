export const getSceneSummaryInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    detail: { type: "string", enum: ["compact", "standard"] },
    includeRecentChanges: { type: "boolean" },
  },
  required: ["detail", "includeRecentChanges"],
} as const;

export const getObjectInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    objectId: { type: "string", minLength: 3, maxLength: 96, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$" },
    includeDataPreview: { type: "boolean" },
  },
  required: ["objectId", "includeDataPreview"],
} as const;

export const setCanvasViewInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["canvas_only", "standard"] },
  },
  required: ["mode"],
} as const;

export const setCanvasViewportInputSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    zoom: { type: "number", minimum: 25, maximum: 300 },
    panX: { type: "number", minimum: -10_000, maximum: 10_000 },
    panY: { type: "number", minimum: -10_000, maximum: 10_000 },
    focusObjectId: {
      type: "string",
      minLength: 3,
      maxLength: 96,
      pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$",
    },
    fit: { type: "boolean" },
  },
} as const;

const writeEnvelopeProperties = {
  operationId: {
    type: "string",
    minLength: 3,
    maxLength: 64,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$",
  },
  expectedDocumentVersion: { type: "integer", minimum: 1, maximum: 2_147_483_647 },
} as const;

export const addChartInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...writeEnvelopeProperties,
    chartSpec: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["bar"] },
        title: { type: "string", minLength: 1, maxLength: 80 },
        categories: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: { type: "string", minLength: 1, maxLength: 24 },
        },
        values: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: { type: "number", minimum: 0, maximum: 100_000 },
        },
        colorToken: { type: "string", enum: ["duo", "coral", "ink", "green"] },
      },
      required: ["kind", "title", "categories", "values", "colorToken"],
    },
    placement: {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "number", minimum: -10_000, maximum: 10_000 },
        y: { type: "number", minimum: -10_000, maximum: 10_000 },
        width: { type: "number", minimum: 240, maximum: 900 },
        height: { type: "number", minimum: 180, maximum: 640 },
      },
    },
    selectAfterCreate: { type: "boolean" },
  },
  required: ["operationId", "expectedDocumentVersion", "chartSpec"],
} as const;

const freehandPointSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "number", minimum: 0, maximum: 1_000 },
    y: { type: "number", minimum: 0, maximum: 1_000 },
    pressure: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["x", "y"],
} as const;

export const addFreehandInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...writeEnvelopeProperties,
    label: { type: "string", minLength: 1, maxLength: 80 },
    points: {
      type: "array",
      minItems: 8,
      maxItems: 256,
      items: freehandPointSchema,
    },
    strokeToken: { type: "string", enum: ["coral", "ink"] },
    strokeWidth: { type: "number", minimum: 1, maximum: 24 },
    placement: {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "number", minimum: -10_000, maximum: 10_000 },
        y: { type: "number", minimum: -10_000, maximum: 10_000 },
        width: { type: "number", minimum: 48, maximum: 1_000 },
        height: { type: "number", minimum: 48, maximum: 1_000 },
      },
      required: ["x", "y", "width", "height"],
    },
    selectAfterCreate: { type: "boolean" },
  },
  required: [
    "operationId",
    "expectedDocumentVersion",
    "label",
    "points",
    "strokeToken",
    "strokeWidth",
    "placement",
  ],
} as const;

export const addTableInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...writeEnvelopeProperties,
    title: { type: "string", minLength: 1, maxLength: 80 },
    columns: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 32 },
    },
    rows: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          oneOf: [
            { type: "string", maxLength: 80 },
            { type: "number", minimum: -1_000_000_000, maximum: 1_000_000_000 },
          ],
        },
      },
    },
    placement: {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "number", minimum: -10_000, maximum: 10_000 },
        y: { type: "number", minimum: -10_000, maximum: 10_000 },
        width: { type: "number", minimum: 240, maximum: 1_000 },
        height: { type: "number", minimum: 120, maximum: 720 },
      },
      required: ["x", "y", "width", "height"],
    },
    selectAfterCreate: { type: "boolean" },
  },
  required: ["operationId", "expectedDocumentVersion", "title", "columns", "rows", "placement"],
} as const;

export const updateObjectInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...writeEnvelopeProperties,
    objectId: { type: "string", minLength: 3, maxLength: 96, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$" },
    changes: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        title: { type: "string", minLength: 1, maxLength: 80 },
        colorToken: { type: "string", enum: ["duo", "coral", "ink", "green"] },
        hidden: { type: "boolean" },
        locked: { type: "boolean" },
        rotation: { type: "number", minimum: -360, maximum: 360 },
        frame: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            x: { type: "number", minimum: -10_000, maximum: 10_000 },
            y: { type: "number", minimum: -10_000, maximum: 10_000 },
            width: { type: "number", minimum: 24, maximum: 1_000 },
            height: { type: "number", minimum: 24, maximum: 1_000 },
          },
        },
      },
    },
    selectAfterUpdate: { type: "boolean" },
  },
  required: ["operationId", "expectedDocumentVersion", "objectId", "changes"],
} as const;

export const undoInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...writeEnvelopeProperties,
    targetOperationId: {
      type: "string",
      minLength: 3,
      maxLength: 64,
      pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$",
    },
  },
  required: ["operationId", "expectedDocumentVersion"],
} as const;
