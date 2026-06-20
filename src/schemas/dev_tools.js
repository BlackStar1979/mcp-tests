const READ_ONLY_DEV_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const DEV_PATH_PROP = {
  type: "string",
  maxLength: 1000,
  description: "Path relative to TEST MCP workspace. Absolute paths and traversal are rejected.",
};

const DEV_CODE_SYMBOLS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: { path: DEV_PATH_PROP },
};

const DEV_CODE_GRAPH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: DEV_PATH_PROP,
    recursive: { type: "boolean", default: true },
    max_files: { type: "integer", minimum: 1, maximum: 1000, default: 500 },
  },
};

const DEV_CODE_AUDIT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    ...DEV_CODE_GRAPH_INPUT_SCHEMA.properties,
    top_n: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

const DEV_CODE_IMPACT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "target"],
  properties: {
    ...DEV_CODE_GRAPH_INPUT_SCHEMA.properties,
    target: DEV_PATH_PROP,
    max_depth: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    direction: { type: "string", enum: ["both", "dependents", "dependencies"], default: "both" },
  },
};

const DEV_CODE_SYNTAX_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: { path: DEV_PATH_PROP },
};

const DEV_CODE_LOCATE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "query"],
  properties: {
    path: DEV_PATH_PROP,
    query: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description: "Literal text or identifier to locate inside one bounded workspace code file.",
    },
    mode: {
      type: "string",
      enum: ["literal", "identifier"],
      default: "literal",
    },
    case_sensitive: { type: "boolean", default: true },
    max_matches: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    include_preview: { type: "boolean", default: false },
    preview_chars: { type: "integer", minimum: 20, maximum: 240, default: 160 },
  },
};

const SYMBOL_SCHEMA = {
  type: "object",
  additionalProperties: true,
};

const DEV_CODE_LOCATE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const DEV_CODE_SYMBOLS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "language", "bytes", "total_lines", "symbol_count", "truncated", "symbols", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    language: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    total_lines: { type: "integer", minimum: 0 },
    symbol_count: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    symbols: { type: "array", items: SYMBOL_SCHEMA },
    error: { type: "string" },
  },
};

const DEV_CODE_DEPENDENCIES_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const DEV_CODE_AUDIT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const DEV_CODE_IMPACT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const DEV_CODE_SYNTAX_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "language", "checker", "ok", "exit_code", "timed_out", "duration_ms", "stdout", "stderr", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    language: { type: "string" },
    checker: { type: "string" },
    ok: { type: "boolean" },
    exit_code: { anyOf: [{ type: "integer" }, { type: "null" }] },
    timed_out: { type: "boolean" },
    duration_ms: { type: "integer", minimum: 0 },
    stdout: { type: "string" },
    stderr: { type: "string" },
    error: { type: "string" },
  },
};

module.exports = {
  DEV_CODE_AUDIT_INPUT_SCHEMA,
  DEV_CODE_AUDIT_OUTPUT_SCHEMA,
  DEV_CODE_DEPENDENCIES_OUTPUT_SCHEMA,
  DEV_CODE_GRAPH_INPUT_SCHEMA,
  DEV_CODE_IMPACT_INPUT_SCHEMA,
  DEV_CODE_IMPACT_OUTPUT_SCHEMA,
  DEV_CODE_LOCATE_INPUT_SCHEMA,
  DEV_CODE_LOCATE_OUTPUT_SCHEMA,
  DEV_CODE_SYMBOLS_INPUT_SCHEMA,
  DEV_CODE_SYMBOLS_OUTPUT_SCHEMA,
  DEV_CODE_SYNTAX_INPUT_SCHEMA,
  DEV_CODE_SYNTAX_OUTPUT_SCHEMA,
  READ_ONLY_DEV_ANNOTATIONS,
};
