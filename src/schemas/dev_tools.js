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

const DEV_CODE_SCENARIO_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "target"],
  properties: {
    ...DEV_CODE_GRAPH_INPUT_SCHEMA.properties,
    target: DEV_PATH_PROP,
    change_type: {
      type: "string",
      enum: ["internal_refactor", "api_change", "rename", "remove", "behavior_change"],
      default: "internal_refactor",
    },
    max_depth: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    direction: { type: "string", enum: ["both", "dependents", "dependencies"], default: "both" },
  },
};

const DEV_CODE_PATCH_PLAN_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "target"],
  properties: {
    ...DEV_CODE_GRAPH_INPUT_SCHEMA.properties,
    target: DEV_PATH_PROP,
    intent: {
      type: "string",
      enum: ["refactor", "change_behavior", "change_api", "rename", "remove"],
      default: "refactor",
    },
    objective: { type: "string", maxLength: 2000 },
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

const OUT_BOOL = { type: "boolean" };
const OUT_INT = { type: "integer" };
const OUT_STRING = { type: "string" };
const OUT_ARRAY = { type: "array", items: {} };
const OUT_OBJECT = { type: "object", additionalProperties: true };

function closedOutputSchema(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: [],
    properties,
  };
}

const DEV_CODE_LOCATE_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  path: OUT_STRING,
  language: OUT_STRING,
  query_sha256_prefix: OUT_STRING,
  mode: OUT_STRING,
  case_sensitive: OUT_BOOL,
  total_lines: OUT_INT,
  match_count: OUT_INT,
  total_matches_estimate: OUT_INT,
  truncated: OUT_BOOL,
  max_matches: OUT_INT,
  include_preview: OUT_BOOL,
  matches: OUT_ARRAY,
});

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

const DEV_CODE_DEPENDENCIES_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  path: OUT_STRING,
  recursive: OUT_BOOL,
  max_files: OUT_INT,
  visited_files: OUT_INT,
  scanned_files: OUT_INT,
  truncated: OUT_BOOL,
  nodes_count: OUT_INT,
  edges_count: OUT_INT,
  external_workspace_edges_count: OUT_INT,
  unresolved_count: OUT_INT,
  nodes: OUT_ARRAY,
  edges: OUT_ARRAY,
  external_workspace_edges: OUT_ARRAY,
  unresolved: OUT_ARRAY,
});

const DEV_CODE_AUDIT_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  path: OUT_STRING,
  recursive: OUT_BOOL,
  max_files: OUT_INT,
  summary: OUT_OBJECT,
  high_fan_in: OUT_ARRAY,
  high_fan_out: OUT_ARRAY,
  external_workspace_edges: OUT_ARRAY,
  unresolved: OUT_ARRAY,
});

const DEV_CODE_IMPACT_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  scope: OUT_STRING,
  direction: OUT_STRING,
  max_depth: OUT_INT,
  graph: OUT_OBJECT,
  target: OUT_STRING,
  requested_target: OUT_STRING,
  found: OUT_BOOL,
  resolution: OUT_STRING,
  target_not_found_reason: OUT_STRING,
  attempted_targets: OUT_ARRAY,
  suggested_targets: OUT_ARRAY,
  scope_path: OUT_STRING,
  maybe_truncated_graph: OUT_BOOL,
  affected_count: OUT_INT,
  dependencies_count: OUT_INT,
  affected: OUT_ARRAY,
  dependencies: OUT_ARRAY,
});

const DEV_CODE_SCENARIO_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  scope: OUT_STRING,
  change_type: OUT_STRING,
  direction: OUT_STRING,
  max_depth: OUT_INT,
  graph: OUT_OBJECT,
  target: OUT_STRING,
  requested_target: OUT_STRING,
  found: OUT_BOOL,
  resolution: OUT_STRING,
  target_not_found_reason: OUT_STRING,
  attempted_targets: OUT_ARRAY,
  suggested_targets: OUT_ARRAY,
  scope_path: OUT_STRING,
  maybe_truncated_graph: OUT_BOOL,
  affected_count: OUT_INT,
  dependencies_count: OUT_INT,
  affected: OUT_ARRAY,
  dependencies: OUT_ARRAY,
  risk: OUT_OBJECT,
  context_files: OUT_ARRAY,
  recommended_checks: OUT_ARRAY,
});

const DEV_CODE_PATCH_PLAN_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  scope: OUT_STRING,
  direction: OUT_STRING,
  max_depth: OUT_INT,
  graph: OUT_OBJECT,
  intent: OUT_STRING,
  objective: OUT_STRING,
  change_type: OUT_STRING,
  scenario: OUT_OBJECT,
  plan: OUT_ARRAY,
  gates: OUT_OBJECT,
  decision: OUT_OBJECT,
  read_plan: OUT_ARRAY,
  anchor_strategy: OUT_OBJECT,
  patch_constraints: OUT_ARRAY,
  validation_plan: OUT_ARRAY,
});

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
  DEV_CODE_PATCH_PLAN_INPUT_SCHEMA,
  DEV_CODE_PATCH_PLAN_OUTPUT_SCHEMA,
  DEV_CODE_SCENARIO_INPUT_SCHEMA,
  DEV_CODE_SCENARIO_OUTPUT_SCHEMA,
  DEV_CODE_SYMBOLS_INPUT_SCHEMA,
  DEV_CODE_SYMBOLS_OUTPUT_SCHEMA,
  DEV_CODE_SYNTAX_INPUT_SCHEMA,
  DEV_CODE_SYNTAX_OUTPUT_SCHEMA,
  READ_ONLY_DEV_ANNOTATIONS,
};
