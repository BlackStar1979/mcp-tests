"use strict";

const READ_ONLY_CODE_SAMPLE_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const IDENTIFIER_PATTERN = "^[A-Za-z_$][A-Za-z0-9_$]*(?:[.#:][A-Za-z_$][A-Za-z0-9_$]*)?$";

const CODE_SAMPLE_JS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "search"],
  properties: {
    path: {
      type: "string",
      description: "Workspace-relative JS/TS file path. Absolute paths are rejected. Default root is C:\\Work\\mcp-tests.",
    },
    search: {
      type: "string",
      pattern: IDENTIFIER_PATTERN,
      minLength: 1,
      maxLength: 160,
      description: "Identifier to extract, e.g. handleRpcMessage, SEARCH_OUTPUT_SCHEMA, docUrl. No arbitrary phrases.",
    },
    extract: {
      type: "string",
      enum: ["auto", "block", "line"],
      default: "auto",
      description: "Extract a whole block, one line, or auto-detect.",
    },
    occurrence: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      default: 1,
      description: "1-based occurrence number.",
    },
    max_chars: {
      type: "integer",
      minimum: 500,
      maximum: 50000,
      default: 12000,
      description: "Maximum returned code characters.",
    },
  },
};

const CODE_SAMPLE_JS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "path",
    "identifier",
    "extract",
    "type",
    "startLine",
    "endLine",
    "code",
    "length",
    "truncated",
    "confidence",
  ],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    identifier: { type: "string" },
    extract: { type: "string" },
    type: { type: "string" },
    startLine: { type: "integer", minimum: 0 },
    endLine: { type: "integer", minimum: 0 },
    code: { type: "string" },
    length: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    confidence: { type: "string" },
    note: { type: "string" },
  },
};

module.exports = {
  CODE_SAMPLE_JS_INPUT_SCHEMA,
  CODE_SAMPLE_JS_OUTPUT_SCHEMA,
  IDENTIFIER_PATTERN,
  READ_ONLY_CODE_SAMPLE_ANNOTATIONS,
};
