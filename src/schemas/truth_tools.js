const READ_ONLY_TRUTH_ANNOTATIONS = {
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

const CHANGED_PATHS_COMMON = {
  type: "array",
  minItems: 1,
  maxItems: 200,
  items: {
    type: "string",
    minLength: 1,
    maxLength: 1000,
  },
};

const CHANGE_FLAGS_COMMON = {
  descriptor_change: { type: "boolean", default: false },
  schema_change: { type: "boolean", default: false },
  tool_surface_change: { type: "boolean", default: false },
};

const CHANGE_GUARD_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changed_paths"],
  properties: {
    changed_paths: CHANGED_PATHS_COMMON,
    ...CHANGE_FLAGS_COMMON,
  },
};

const CHANGE_FLAGS_OUTPUT_PROPERTIES = {
  descriptor_change: { type: "boolean" },
  schema_change: { type: "boolean" },
  tool_surface_change: { type: "boolean" },
};

const CHANGE_GUARD_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "guard_version",
    "current_working_course",
    "next_primary",
    "next_secondary",
    "changed_paths",
    "flags",
    "classification",
    "requires_restart_mcp",
    "requires_connector_refresh",
    "requires_operator_approval",
    "workflow",
    "reasons",
  ],
  properties: {
    status: { type: "string", enum: ["ok"] },
    guard_version: { type: "string" },
    current_working_course: { type: "string" },
    next_primary: { type: "string" },
    next_secondary: { type: "string" },
    changed_paths: CHANGED_PATHS_COMMON,
    flags: {
      type: "object",
      additionalProperties: false,
      required: ["descriptor_change", "schema_change", "tool_surface_change"],
      properties: CHANGE_FLAGS_OUTPUT_PROPERTIES,
    },
    classification: {
      type: "string",
      enum: [
        "repo_only",
        "repo_or_internal_source",
        "runtime_status_restart_required",
        "runtime_restart_required",
        "runtime_with_connector_refresh",
      ],
    },
    requires_restart_mcp: { type: "boolean" },
    requires_connector_refresh: { type: "boolean" },
    requires_operator_approval: { type: "boolean" },
    workflow: { type: "array", items: { type: "string" } },
    reasons: { type: "array", items: { type: "string" } },
  },
};

const CHANGE_WORKFLOW_SIMULATOR_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "read_only",
    "connector_visible",
    "current_working_course",
    "next_primary",
    "next_secondary",
    "changed_paths",
    "flags",
    "classification",
    "workflow",
  ],
  properties: {
    version: { type: "string" },
    read_only: { type: "boolean" },
    connector_visible: { type: "boolean" },
    current_working_course: { type: "string" },
    next_primary: { type: "string" },
    next_secondary: { type: "string" },
    changed_paths: CHANGED_PATHS_COMMON,
    flags: {
      type: "object",
      additionalProperties: false,
      required: ["descriptor_change", "schema_change", "tool_surface_change"],
      properties: CHANGE_FLAGS_OUTPUT_PROPERTIES,
    },
    classification: CHANGE_GUARD_OUTPUT_SCHEMA.properties.classification,
    workflow: { type: "array", items: { type: "string" } },
  },
};

const FINDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["severity", "code"],
  properties: {
    severity: { type: "string", enum: ["warning", "error"] },
    code: { type: "string" },
    file: { type: "string" },
    expected: { type: "string" },
    actual: { type: "string" },
    mechanism: { type: "string" },
  },
};

const PROJECT_TRUTH_AUDIT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "status",
    "read_only",
    "connector_visible",
    "current",
    "expected",
    "checked_docs",
    "findings",
  ],
  properties: {
    version: { type: "string" },
    status: { type: "string", enum: ["ok", "drift_detected"] },
    read_only: { type: "boolean" },
    connector_visible: { type: "boolean" },
    current: {
      type: "object",
      additionalProperties: false,
      required: [
        "runtime_compatibility_label",
        "runtime_stage_status",
        "current_working_course",
        "next_primary",
        "next_secondary",
      ],
      properties: {
        runtime_compatibility_label: { type: "string" },
        runtime_stage_status: { type: "string" },
        current_working_course: { type: "string" },
        next_primary: { type: "string" },
        next_secondary: { type: "string" },
      },
    },
    expected: { type: "object", additionalProperties: true },
    checked_docs: { type: "array", items: { type: "string" } },
    findings: { type: "array", items: FINDING_SCHEMA },
  },
};

const CODE_RUNTIME_MAP_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "status",
    "read_only",
    "connector_visible",
    "stage_plan",
    "runtime_entrypoints",
    "planned_truth_modules",
    "canonical_docs",
    "control_plane",
    "guards",
    "missing",
    "invariant",
  ],
  properties: {
    version: { type: "string" },
    status: { type: "string", enum: ["ok", "missing_expected_files"] },
    read_only: { type: "boolean" },
    connector_visible: { type: "boolean" },
    stage_plan: {
      type: "object",
      additionalProperties: false,
      required: ["current", "next_primary", "next_secondary"],
      properties: {
        current: { type: "string" },
        next_primary: { type: "string" },
        next_secondary: { type: "string" },
      },
    },
    runtime_entrypoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["file", "role", "planned_stage"],
        properties: {
          file: { type: "string" },
          role: { type: "string" },
          planned_stage: { type: "string" },
        },
      },
    },
    planned_truth_modules: { type: "array", items: { type: "string" } },
    canonical_docs: { type: "array", items: { type: "string" } },
    control_plane: { type: "array", items: { type: "string" } },
    guards: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" } },
    invariant: { type: "string" },
  },
};

const TOOL_USAGE_SNAPSHOT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "snapshot_version",
    "source_log",
    "log_available",
    "total_tool_invocations",
    "unique_tool_count",
    "time_window",
    "top_tools",
    "family_counts",
    "notes",
  ],
  properties: {
    status: { type: "string", enum: ["ok"] },
    snapshot_version: { type: "string" },
    source_log: { type: "string" },
    log_available: { type: "boolean" },
    total_tool_invocations: { type: "integer", minimum: 0 },
    unique_tool_count: { type: "integer", minimum: 0 },
    time_window: {
      type: "object",
      additionalProperties: false,
      required: ["first_ts", "last_ts"],
      properties: {
        first_ts: { type: ["string", "null"] },
        last_ts: { type: ["string", "null"] },
      },
    },
    top_tools: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "count"],
        properties: {
          name: { type: "string" },
          count: { type: "integer", minimum: 0 },
        },
      },
    },
    family_counts: {
      type: "object",
      additionalProperties: false,
      required: ["truth_tools", "process_tools", "registry_tools", "web_tools", "other_tools"],
      properties: {
        truth_tools: { type: "integer", minimum: 0 },
        process_tools: { type: "integer", minimum: 0 },
        registry_tools: { type: "integer", minimum: 0 },
        web_tools: { type: "integer", minimum: 0 },
        other_tools: { type: "integer", minimum: 0 },
      },
    },
    web_tool_counts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "count"],
        properties: {
          name: { type: "string" },
          count: { type: "integer", minimum: 0 },
        },
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
};

module.exports = {
  CHANGE_GUARD_INPUT_SCHEMA,
  CHANGE_GUARD_OUTPUT_SCHEMA,
  CHANGE_WORKFLOW_SIMULATOR_OUTPUT_SCHEMA,
  CODE_RUNTIME_MAP_OUTPUT_SCHEMA,
  EMPTY_INPUT_SCHEMA,
  PROJECT_TRUTH_AUDIT_OUTPUT_SCHEMA,
  READ_ONLY_TRUTH_ANNOTATIONS,
  TOOL_USAGE_SNAPSHOT_OUTPUT_SCHEMA,
};
