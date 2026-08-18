"use strict";

const {
  READ_ONLY_DEV_ANNOTATIONS,
  DEV_CODE_GRAPH_INPUT_SCHEMA,
  DEV_CODE_PATCH_PLAN_INPUT_SCHEMA,
} = require("./dev_tools");
const {
  STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
} = require("./workspace_mutation_tools");

const CODE_MUTATION_PATH_PROP = DEV_CODE_GRAPH_INPUT_SCHEMA.properties.path;
const OUT_BOOL = { type: "boolean" };
const OUT_INT = { type: "integer" };
const OUT_STRING = { type: "string" };
const OUT_ARRAY = { type: "array", items: {} };
const OUT_OBJECT = { type: "object", additionalProperties: true };
const OUT_ANY = {};
const OUT_NULLABLE_STRING = { anyOf: [OUT_STRING, { type: "null" }] };

function closedOutputSchema(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: [],
    properties,
  };
}

const CODE_ORCHESTRATE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "target"],
  properties: {
    ...DEV_CODE_PATCH_PLAN_INPUT_SCHEMA.properties,
  },
};

const CODE_ORCHESTRATE_OUTPUT_SCHEMA = closedOutputSchema({
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
});

const CODE_APPLY_PATCH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "target", "anchor", "content"],
  properties: {
    path: CODE_MUTATION_PATH_PROP,
    target: { type: "string", minLength: 1, maxLength: 1000 },
    anchor: { type: "string", minLength: 1 },
    content: { type: "string" },
    mode: { type: "string", enum: ["before", "after", "replace"], default: "replace" },
    intent: {
      type: "string",
      enum: ["refactor", "change_behavior", "change_api", "rename", "remove"],
      default: "refactor",
    },
    objective: { type: "string", maxLength: 2000 },
    recursive: { type: "boolean", default: true },
    max_files: { type: "integer", minimum: 1, maximum: 1000, default: 500 },
    max_depth: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    direction: { type: "string", enum: ["both", "dependents", "dependencies"], default: "both" },
    dry_run: { type: "boolean", default: true },
    confirm: { type: "boolean", default: false },
    commit_ref: { type: "string", maxLength: 200 },
    allow_protected: { type: "boolean", default: false },
    require_markers: {
      type: "array",
      default: [],
      items: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
};

const CODE_APPLY_PATCH_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  status: OUT_STRING,
  applied: OUT_BOOL,
  operation_id: OUT_STRING,
  scope: OUT_STRING,
  target: OUT_STRING,
  source_sha256: OUT_STRING,
  mode: OUT_STRING,
  anchor_matches: OUT_INT,
  bytes_before: OUT_INT,
  bytes_after: OUT_INT,
  delta_bytes: OUT_INT,
  dry_run: OUT_BOOL,
  plan: OUT_OBJECT,
  backup: OUT_STRING,
  validation: OUT_OBJECT,
});

const CODE_ROLLBACK_PATCH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["operation_id"],
  properties: {
    operation_id: { type: "string", minLength: 1, maxLength: 200 },
    confirm: { type: "boolean", default: false },
  },
};

const CODE_ROLLBACK_PATCH_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  status: OUT_STRING,
  applied: OUT_BOOL,
  operation_id: OUT_STRING,
  source_operation: OUT_STRING,
  source_status: OUT_NULLABLE_STRING,
  target: OUT_STRING,
  backup: OUT_STRING,
  restored_from: OUT_STRING,
  bytes_before: OUT_INT,
  bytes_after: OUT_INT,
});

const TOOL_DISPATCH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool", "input"],
  properties: {
    tool: { type: "string", minLength: 1, maxLength: 100 },
    input: { type: "object" },
  },
};

const TOOL_DISPATCH_OUTPUT_SCHEMA = closedOutputSchema({
  success: OUT_BOOL,
  error: OUT_STRING,
  status: OUT_STRING,
  tool: OUT_STRING,
  operation: OUT_STRING,
  result: OUT_ANY,
});

module.exports = {
  CODE_APPLY_PATCH_INPUT_SCHEMA,
  CODE_APPLY_PATCH_OUTPUT_SCHEMA,
  CODE_ORCHESTRATE_INPUT_SCHEMA,
  CODE_ORCHESTRATE_OUTPUT_SCHEMA,
  CODE_ROLLBACK_PATCH_INPUT_SCHEMA,
  CODE_ROLLBACK_PATCH_OUTPUT_SCHEMA,
  READ_ONLY_CODE_MUTATION_ORCHESTRATION_ANNOTATIONS: READ_ONLY_DEV_ANNOTATIONS,
  STATE_CHANGING_CODE_MUTATION_ANNOTATIONS: STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  TOOL_DISPATCH_INPUT_SCHEMA,
  TOOL_DISPATCH_OUTPUT_SCHEMA,
};
