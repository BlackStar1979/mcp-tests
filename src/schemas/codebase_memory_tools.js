"use strict";

const READ_ONLY_CBM_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

const MUTATING_CBM_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
});

const INDEXING_CBM_ANNOTATIONS = MUTATING_CBM_ANNOTATIONS;

const DESTRUCTIVE_CBM_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
});

const EMPTY_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
});

const PROJECT_PROPERTY = Object.freeze({
  type: "string",
  minLength: 1,
  maxLength: 256,
  description: "Name of an existing codebase-memory project/index.",
});

function objectSchema(required, properties) {
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    required,
    properties,
  });
}

function boundedString(maxLength = 512, description = undefined) {
  const schema = { type: "string", minLength: 1, maxLength };
  if (description) schema.description = description;
  return schema;
}

function stringArray(maxItems = 64, itemMaxLength = 256) {
  return {
    type: "array",
    minItems: 1,
    maxItems,
    items: { type: "string", minLength: 1, maxLength: itemMaxLength },
  };
}

const CBM_STATUS_INPUT_SCHEMA = EMPTY_INPUT_SCHEMA;
const CBM_LIST_PROJECTS_INPUT_SCHEMA = EMPTY_INPUT_SCHEMA;

const CBM_INDEX_REPOSITORY_INPUT_SCHEMA = objectSchema(["path"], {
  path: {
    type: "string",
    minLength: 1,
    maxLength: 1000,
    description: "Repository directory inside an authorized TEST MCP workspace root. Absolute paths and traversal are rejected.",
  },
  mode: {
    type: "string",
    enum: ["full", "moderate", "fast", "cross-repo-intelligence"],
    default: "full",
  },
  target_projects: stringArray(64, 256),
  name: boundedString(256),
  persistence: { type: "boolean", default: false },
});

const CBM_GET_ARCHITECTURE_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
  path: boundedString(1000),
  aspects: stringArray(32, 128),
});

const CBM_SEARCH_GRAPH_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
  query: boundedString(2000),
  label: boundedString(64),
  name_pattern: boundedString(512),
  qn_pattern: boundedString(1000),
  file_pattern: boundedString(1000),
  relationship: boundedString(64),
  min_degree: { type: "integer", minimum: 0, maximum: 1000000 },
  max_degree: { type: "integer", minimum: 0, maximum: 1000000 },
  exclude_entry_points: { type: "boolean" },
  include_connected: { type: "boolean" },
  semantic_query: stringArray(32, 256),
  limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  offset: { type: "integer", minimum: 0, maximum: 1000000, default: 0 },
});

const CBM_QUERY_GRAPH_INPUT_SCHEMA = objectSchema(["project", "query"], {
  project: PROJECT_PROPERTY,
  query: boundedString(20000, "Read-only Cypher query accepted by the native CBM subset."),
  max_rows: { type: "integer", minimum: 1, maximum: 100000 },
});

const CBM_TRACE_PATH_INPUT_SCHEMA = objectSchema(["project", "function_name"], {
  project: PROJECT_PROPERTY,
  function_name: boundedString(1000),
  direction: { type: "string", enum: ["inbound", "outbound", "both"], default: "both" },
  depth: { type: "integer", minimum: 1, maximum: 5, default: 3 },
  mode: { type: "string", enum: ["calls", "data_flow", "cross_service"], default: "calls" },
  parameter_name: boundedString(256),
  edge_types: stringArray(64, 64),
  risk_labels: { type: "boolean", default: false },
  include_tests: { type: "boolean", default: false },
});

const CBM_GET_CODE_SNIPPET_INPUT_SCHEMA = objectSchema(["project", "qualified_name"], {
  project: PROJECT_PROPERTY,
  qualified_name: boundedString(2000),
  include_neighbors: { type: "boolean", default: false },
});

const CBM_GET_GRAPH_SCHEMA_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
});

const CBM_SEARCH_CODE_INPUT_SCHEMA = objectSchema(["project", "pattern"], {
  project: PROJECT_PROPERTY,
  pattern: boundedString(2000),
  file_pattern: boundedString(512),
  path_filter: boundedString(1000),
  mode: { type: "string", enum: ["compact", "full", "files"], default: "compact" },
  context: { type: "integer", minimum: 0, maximum: 100 },
  regex: { type: "boolean", default: false },
  limit: { type: "integer", minimum: 1, maximum: 200, default: 10 },
});

const CBM_DELETE_PROJECT_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
  confirm: { type: "boolean", const: true },
  state_handle: { type: "string", minLength: 24, maxLength: 512 },
});

const CBM_INDEX_STATUS_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
});

const CBM_DETECT_CHANGES_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
  scope: boundedString(1000),
  depth: { type: "integer", minimum: 0, maximum: 10, default: 2 },
  base_branch: boundedString(256),
  since: boundedString(256),
});

const CBM_MANAGE_ADR_INPUT_SCHEMA = objectSchema(["project"], {
  project: PROJECT_PROPERTY,
  mode: { type: "string", enum: ["get", "update", "sections"] },
  content: { type: "string", maxLength: 100000 },
  sections: stringArray(64, 256),
});

const TRACE_TIME_PROPERTY = Object.freeze({
  oneOf: [
    { type: "integer", minimum: 0 },
    { type: "string", pattern: "^[0-9]{1,32}$" },
  ],
});

const CBM_INGEST_TRACES_INPUT_SCHEMA = objectSchema(["project", "traces"], {
  project: PROJECT_PROPERTY,
  traces: {
    type: "array",
    minItems: 1,
    maxItems: 1000,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["trace_id", "span_id", "name", "start_time_unix_nano", "end_time_unix_nano"],
      properties: {
        trace_id: boundedString(256),
        span_id: boundedString(256),
        parent_span_id: boundedString(256),
        name: boundedString(2000),
        kind: boundedString(128),
        start_time_unix_nano: TRACE_TIME_PROPERTY,
        end_time_unix_nano: TRACE_TIME_PROPERTY,
        status_code: boundedString(128),
        attributes: { type: "object", additionalProperties: true, maxProperties: 256 },
      },
    },
  },
});

const NULLABLE_INTEGER_SCHEMA = Object.freeze({
  oneOf: [{ type: "integer" }, { type: "null" }],
});

const NULLABLE_STRING_SCHEMA = Object.freeze({
  oneOf: [{ type: "string" }, { type: "null" }],
});

const CBM_BRIDGE_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "error_code",
    "error",
    "cbm_tool",
    "duration_ms",
    "queue_wait_ms",
    "execution_ms",
    "binary_version",
    "compatibility_status",
    "partial_success",
    "warnings",
    "timed_out",
    "exit_code",
    "signal",
    "stdout_truncated",
    "stderr_truncated",
    "diagnostic",
    "result",
  ],
  properties: {
    success: { type: "boolean" },
    error_code: { type: "string" },
    error: { type: "string" },
    cbm_tool: { type: "string" },
    duration_ms: { type: "integer", minimum: 0 },
    queue_wait_ms: { type: "integer", minimum: 0 },
    execution_ms: { type: "integer", minimum: 0 },
    binary_version: { type: "string" },
    compatibility_status: { type: "string" },
    partial_success: { type: "boolean" },
    warnings: { type: "array", maxItems: 40, items: { type: "string", maxLength: 1000 } },
    timed_out: { type: "boolean" },
    exit_code: NULLABLE_INTEGER_SCHEMA,
    signal: NULLABLE_STRING_SCHEMA,
    stdout_truncated: { type: "boolean" },
    stderr_truncated: { type: "boolean" },
    diagnostic: { type: "string" },
    result: {},
  },
});

const CBM_TIMEOUTS_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["probe", "simple_read", "heavy_read", "index", "hard_index"],
  properties: {
    probe: { type: "integer", minimum: 0 },
    simple_read: { type: "integer", minimum: 0 },
    heavy_read: { type: "integer", minimum: 0 },
    index: { type: "integer", minimum: 0 },
    hard_index: { type: "integer", minimum: 0 },
  },
});

const CBM_STATUS_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "enabled",
    "available",
    "executable_path",
    "executable_exists",
    "executable_regular_file",
    "executable_size",
    "executable_mtime_ms",
    "executable_sha256",
    "version_probe_ok",
    "version",
    "manifest_version",
    "compatibility_status",
    "compatibility_accepted",
    "native_tool_count",
    "native_tools",
    "binary_changed_since_probe",
    "allowed_root",
    "error_code",
    "error",
    "watcher_mode",
    "freshness_note",
    "timeouts_ms",
    "index_busy",
    "mutation_busy",
    "active_mutation_tool",
    "heavy_read_capacity",
    "heavy_read_active",
    "heavy_read_queued",
  ],
  properties: {
    enabled: { type: "boolean" },
    available: { type: "boolean" },
    executable_path: { type: "string" },
    executable_exists: { type: "boolean" },
    executable_regular_file: { type: "boolean" },
    executable_size: { type: "integer", minimum: 0 },
    executable_mtime_ms: { type: "number", minimum: 0 },
    executable_sha256: { type: "string", pattern: "^(?:[a-f0-9]{64})?$" },
    version_probe_ok: { type: "boolean" },
    version: { type: "string" },
    manifest_version: { type: "string" },
    compatibility_status: { type: "string" },
    compatibility_accepted: { type: "boolean" },
    native_tool_count: { type: "integer", minimum: 0 },
    native_tools: { type: "array", maxItems: 64, items: { type: "string", maxLength: 128 } },
    binary_changed_since_probe: { type: "boolean" },
    allowed_root: { type: "string" },
    error_code: { type: "string" },
    error: { type: "string" },
    watcher_mode: { type: "string", enum: ["not_managed_by_bridge"] },
    freshness_note: { type: "string" },
    timeouts_ms: CBM_TIMEOUTS_OUTPUT_SCHEMA,
    index_busy: { type: "boolean" },
    mutation_busy: { type: "boolean" },
    active_mutation_tool: { type: "string" },
    heavy_read_capacity: { type: "integer", minimum: 1 },
    heavy_read_active: { type: "integer", minimum: 0 },
    heavy_read_queued: { type: "integer", minimum: 0 },
  },
});

module.exports = {
  CBM_BRIDGE_OUTPUT_SCHEMA,
  CBM_DELETE_PROJECT_INPUT_SCHEMA,
  CBM_DETECT_CHANGES_INPUT_SCHEMA,
  CBM_GET_ARCHITECTURE_INPUT_SCHEMA,
  CBM_GET_CODE_SNIPPET_INPUT_SCHEMA,
  CBM_GET_GRAPH_SCHEMA_INPUT_SCHEMA,
  CBM_INDEX_REPOSITORY_INPUT_SCHEMA,
  CBM_INDEX_STATUS_INPUT_SCHEMA,
  CBM_INGEST_TRACES_INPUT_SCHEMA,
  CBM_LIST_PROJECTS_INPUT_SCHEMA,
  CBM_MANAGE_ADR_INPUT_SCHEMA,
  CBM_QUERY_GRAPH_INPUT_SCHEMA,
  CBM_SEARCH_CODE_INPUT_SCHEMA,
  CBM_SEARCH_GRAPH_INPUT_SCHEMA,
  CBM_STATUS_INPUT_SCHEMA,
  CBM_STATUS_OUTPUT_SCHEMA,
  CBM_TRACE_PATH_INPUT_SCHEMA,
  DESTRUCTIVE_CBM_ANNOTATIONS,
  INDEXING_CBM_ANNOTATIONS,
  MUTATING_CBM_ANNOTATIONS,
  READ_ONLY_CBM_ANNOTATIONS,
};
