const READ_ONLY_PLUGIN_VISIBILITY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const EMPTY_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const PLUGIN_VISIBILITY_PLAN_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool_name", "target_state"],
  properties: {
    tool_name: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
    target_state: {
      type: "string",
      enum: ["enabled", "disabled", "quarantined", "candidate"],
    },
  },
};

const GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true,
};

const LOOSE_OBJECT_SCHEMA = { type: "object", additionalProperties: true };
const STRING_ARRAY_SCHEMA = { type: "array", items: { type: "string" } };

const PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "error",
    "visibility_registry_version",
    "mode",
    "tool_surface_mutation_enabled",
    "dynamic_import_enabled",
    "plugin_execution_enabled",
    "list_changed_enabled",
    "active_core_tool_count",
    "active_core_tools",
    "candidate_tool_count",
    "visible_candidate_tool_count",
    "executable_candidate_tool_count",
    "candidate_by_state",
    "candidate_tools",
    "registry_ok",
    "registry_errors",
    "list_changed",
  ],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    visibility_registry_version: { type: "string" },
    mode: { type: "string" },
    tool_surface_mutation_enabled: { type: "boolean" },
    dynamic_import_enabled: { type: "boolean" },
    plugin_execution_enabled: { type: "boolean" },
    list_changed_enabled: { type: "boolean" },
    active_core_tool_count: { type: "integer" },
    active_core_tools: STRING_ARRAY_SCHEMA,
    candidate_tool_count: { type: "integer" },
    visible_candidate_tool_count: { type: "integer" },
    executable_candidate_tool_count: { type: "integer" },
    candidate_by_state: LOOSE_OBJECT_SCHEMA,
    candidate_tools: { type: "array", items: LOOSE_OBJECT_SCHEMA },
    registry_ok: { type: "boolean" },
    registry_errors: STRING_ARRAY_SCHEMA,
    list_changed: LOOSE_OBJECT_SCHEMA,
  },
};

const PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "error",
    "mode",
    "tool_name",
    "plugin_id",
    "current_state",
    "target_state",
    "state_overlay",
    "current_visible_in_tools_list",
    "target_visible_in_tools_list",
    "would_change_tools_list",
    "would_require_list_changed",
    "real_mutation_enabled",
    "plan_allowed_now",
    "execute_allowed_now",
    "dynamic_import_enabled",
    "plugin_execution_enabled",
    "list_changed_enabled",
    "blockers",
    "warnings",
    "required_approvals",
    "planned_diff",
    "list_changed",
  ],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    mode: { type: "string" },
    tool_name: { type: "string" },
    plugin_id: { type: "string" },
    plugin_version: { type: "string" },
    current_state: { type: "string" },
    target_state: { type: "string" },
    state_overlay: LOOSE_OBJECT_SCHEMA,
    current_visible_in_tools_list: { type: "boolean" },
    target_visible_in_tools_list: { type: "boolean" },
    would_change_tools_list: { type: "boolean" },
    would_require_list_changed: { type: "boolean" },
    real_mutation_enabled: { type: "boolean" },
    plan_allowed_now: { type: "boolean" },
    execute_allowed_now: { type: "boolean" },
    dynamic_import_enabled: { type: "boolean" },
    plugin_execution_enabled: { type: "boolean" },
    list_changed_enabled: { type: "boolean" },
    risk: { type: "string" },
    public_safe: { type: "boolean" },
    profile_allowed: STRING_ARRAY_SCHEMA,
    blockers: STRING_ARRAY_SCHEMA,
    warnings: STRING_ARRAY_SCHEMA,
    required_approvals: STRING_ARRAY_SCHEMA,
    planned_diff: LOOSE_OBJECT_SCHEMA,
    list_changed: LOOSE_OBJECT_SCHEMA,
    next_stage_hint: { type: "string" },
  },
};

module.exports = {
  EMPTY_INPUT_SCHEMA,
  GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA,
  PLUGIN_VISIBILITY_PLAN_INPUT_SCHEMA,
  PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA,
  PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_PLUGIN_VISIBILITY_ANNOTATIONS,
};
