const READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const STATE_CHANGING_WORKSPACE_INDEX_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const INDEX_STATUS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {},
};

const BUILD_INDEX_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    path: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      default: ".",
      description: "Optional workspace-relative file or directory scope. Bare paths resolve under the primary work root; @alias/... selects an explicit extra root.",
    },
    max_files: { type: "integer", minimum: 1, maximum: 50000, default: 20000 },
    max_dirs: { type: "integer", minimum: 1, maximum: 20000, default: 5000 },
    profile: {
      type: "string",
      enum: ["knowledge", "source", "all"],
      default: "knowledge",
      description: "Indexing profile. knowledge indexes documentation and structured project-truth files; source indexes code-like files; all preserves the legacy mixed behavior.",
    },
  },
};

const SEARCH_INDEX_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: 400 },
    limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
    path: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      default: ".",
      description: "Optional indexed-display-path prefix filter, for example mcp-tests/src or @alias/path.",
    },
  },
};

const SEARCH_INDEX_CONTEXT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: 400 },
    limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    path: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      default: ".",
      description: "Optional indexed-display-path prefix filter, for example mcp-tests/src or @alias/path.",
    },
  },
};

const COLLECT_CONTEXT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: 400 },
    limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
    max_chars_per_file: { type: "integer", minimum: 500, maximum: 30000, default: 8000 },
    path: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      default: ".",
      description: "Optional indexed-display-path prefix filter, for example mcp-tests/src or @alias/path.",
    },
  },
};

const COLLECT_ROMIONSIM_CONTEXT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: 400 },
    limit: { type: "integer", minimum: 1, maximum: 30, default: 12 },
    include_pinned: { type: "boolean", default: true },
    path: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      default: "romionsim",
      description: "Optional indexed-display-path prefix filter inside romionsim context, for example romionsim/docs.",
    },
  },
};

const INDEX_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "title", "kind", "authority", "format", "score", "snippet"],
  properties: {
    path: { type: "string" },
    title: { type: "string" },
    kind: { type: "string" },
    authority: { type: "string" },
    format: { type: "string" },
    score: { type: "number" },
    snippet: { type: "string" },
    role: { type: "string" },
  },
};

const INDEX_CONTEXT_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "title", "kind", "authority", "format", "score", "context"],
  properties: {
    path: { type: "string" },
    title: { type: "string" },
    kind: { type: "string" },
    authority: { type: "string" },
    format: { type: "string" },
    score: { type: "number" },
    context: { type: "string" },
  },
};

const COLLECT_CONTEXT_FILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "title", "kind", "authority", "format", "score", "text"],
  properties: {
    path: { type: "string" },
    title: { type: "string" },
    kind: { type: "string" },
    authority: { type: "string" },
    format: { type: "string" },
    score: { type: "number" },
    text: { type: "string" },
  },
};

const INDEX_SCOPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "root_alias", "display_path", "mode"],
  properties: {
    path: { type: "string" },
    root_alias: { type: "string" },
    display_path: { type: "string" },
    mode: { type: "string", enum: ["", "all_roots", "directory", "file"] },
  },
};

const INDEX_RETRIEVAL_METADATA_REQUIRED = [
  "index_scope",
  "path_filter",
  "index_profile",
  "index_truncated",
  "index_created_at",
  "index_count",
];

const INDEX_RETRIEVAL_METADATA_PROPERTIES = {
  index_scope: INDEX_SCOPE_SCHEMA,
  path_filter: { type: "string" },
  index_profile: { type: "string" },
  index_truncated: { type: "boolean" },
  index_created_at: { type: "string" },
  index_count: { type: "integer", minimum: 0 },
};

const INDEX_COUNTER_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "count"],
  properties: {
    name: { type: "string" },
    count: { type: "integer", minimum: 0 },
  },
};

const INDEX_AUTHORITY_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "title", "kind", "authority", "modified"],
  properties: {
    path: { type: "string" },
    title: { type: "string" },
    kind: { type: "string" },
    authority: { type: "string" },
    modified: { type: "string" },
  },
};

const WORKFLOW_CANONICAL_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "path", "present", "kind", "authority", "modified"],
  properties: {
    id: { type: "string" },
    path: { type: "string" },
    present: { type: "boolean" },
    kind: { type: "string" },
    authority: { type: "string" },
    modified: { type: "string" },
  },
};

const WORKFLOW_SERVER_SPECS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["count", "sample_paths"],
  properties: {
    count: { type: "integer", minimum: 0 },
    sample_paths: { type: "array", items: { type: "string" } },
  },
};

const WORKFLOW_MARKERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["current_working_course", "next_primary", "next_secondary", "stage_labels"],
  properties: {
    current_working_course: { type: "string" },
    next_primary: { type: "string" },
    next_secondary: { type: "string" },
    stage_labels: { type: "array", items: { type: "string" } },
  },
};

const WORKFLOW_RUNTIME_IDENTITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "server_name",
    "server_version",
    "connector_shape_version",
    "output_mode",
    "public_port",
    "authorized_port",
    "public_tool_count",
    "authorized_tool_count",
    "authenticated_total_tool_count",
  ],
  properties: {
    server_name: { type: "string" },
    server_version: { type: "string" },
    connector_shape_version: { type: "string" },
    output_mode: { type: "string" },
    public_port: { type: "integer", minimum: 0 },
    authorized_port: { type: "integer", minimum: 0 },
    public_tool_count: { type: "integer", minimum: 0 },
    authorized_tool_count: { type: "integer", minimum: 0 },
    authenticated_total_tool_count: { type: "integer", minimum: 0 },
  },
};

const WORKFLOW_READINESS_COMPONENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "component",
    "maturity",
    "northstar_role",
    "depends_on",
    "current_evidence",
    "main_blocker",
    "default_next_package",
    "done_signal",
  ],
  properties: {
    id: { type: "string" },
    component: { type: "string" },
    maturity: { type: "string" },
    northstar_role: { type: "string" },
    depends_on: { type: "string" },
    current_evidence: { type: "string" },
    main_blocker: { type: "string" },
    default_next_package: { type: "string" },
    done_signal: { type: "string" },
  },
};

const WORKFLOW_READINESS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "updated", "component_count", "components"],
  properties: {
    status: { type: "string" },
    updated: { type: "string" },
    component_count: { type: "integer", minimum: 0 },
    components: { type: "array", items: WORKFLOW_READINESS_COMPONENT_SCHEMA },
  },
};

const WORKFLOW_ROADMAP_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["priority", "item", "depends_on", "why_now", "current_action"],
  properties: {
    priority: { type: "string" },
    item: { type: "string" },
    depends_on: { type: "string" },
    why_now: { type: "string" },
    current_action: { type: "string" },
  },
};

const WORKFLOW_ROADMAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "updated", "item_count", "items"],
  properties: {
    status: { type: "string" },
    updated: { type: "string" },
    item_count: { type: "integer", minimum: 0 },
    items: { type: "array", items: WORKFLOW_ROADMAP_ITEM_SCHEMA },
  },
};

const WORKFLOW_DOCUMENTATION_GAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["severity", "area", "issue", "detail"],
  properties: {
    severity: { type: "string" },
    area: { type: "string" },
    issue: { type: "string" },
    detail: { type: "string" },
  },
};

const WORKFLOW_HEALTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "has_northstar",
    "has_state",
    "has_readiness",
    "has_roadmap",
    "has_workflow_canon",
    "has_runtime_identity",
    "source_of_truth_count",
  ],
  properties: {
    has_northstar: { type: "boolean" },
    has_state: { type: "boolean" },
    has_readiness: { type: "boolean" },
    has_roadmap: { type: "boolean" },
    has_workflow_canon: { type: "boolean" },
    has_runtime_identity: { type: "boolean" },
    source_of_truth_count: { type: "integer", minimum: 0 },
  },
};

const WORKFLOW_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "canonical_docs",
    "server_specs",
    "workflow_markers",
    "runtime_identity",
    "readiness",
    "roadmap",
    "documentation_gaps",
    "health",
  ],
  properties: {
    canonical_docs: { type: "array", items: WORKFLOW_CANONICAL_DOC_SCHEMA },
    server_specs: WORKFLOW_SERVER_SPECS_SCHEMA,
    workflow_markers: WORKFLOW_MARKERS_SCHEMA,
    runtime_identity: WORKFLOW_RUNTIME_IDENTITY_SCHEMA,
    readiness: WORKFLOW_READINESS_SCHEMA,
    roadmap: WORKFLOW_ROADMAP_SCHEMA,
    documentation_gaps: { type: "array", items: WORKFLOW_DOCUMENTATION_GAP_SCHEMA },
    health: WORKFLOW_HEALTH_SCHEMA,
  },
};

const KNOWLEDGE_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "profile",
    "by_kind",
    "by_authority",
    "by_format",
    "top_level_areas",
    "top_subareas",
    "top_authority_docs",
    "workflow_summary",
  ],
  properties: {
    profile: { type: "string" },
    by_kind: { type: "array", items: INDEX_COUNTER_ITEM_SCHEMA },
    by_authority: { type: "array", items: INDEX_COUNTER_ITEM_SCHEMA },
    by_format: { type: "array", items: INDEX_COUNTER_ITEM_SCHEMA },
    top_level_areas: { type: "array", items: INDEX_COUNTER_ITEM_SCHEMA },
    top_subareas: { type: "array", items: INDEX_COUNTER_ITEM_SCHEMA },
    top_authority_docs: { type: "array", items: INDEX_AUTHORITY_DOC_SCHEMA },
    workflow_summary: WORKFLOW_SUMMARY_SCHEMA,
  },
};

const INDEX_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "count", "created_at", "root", "version", "profile", "knowledge_summary"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string", enum: ["ok", "missing", "error"] },
    count: { type: "integer", minimum: 0 },
    created_at: { type: "string" },
    root: { type: "string" },
    version: { type: "integer", minimum: 0 },
    roots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["alias", "path", "primary"],
        properties: {
          alias: { type: "string" },
          path: { type: "string" },
          primary: { type: "boolean" },
        },
      },
    },
    scope: INDEX_SCOPE_SCHEMA,
    profile: { type: "string" },
    visited_files: { type: "integer", minimum: 0 },
    visited_dirs: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    max_files: { type: "integer", minimum: 0 },
    max_dirs: { type: "integer", minimum: 0 },
    knowledge_summary: KNOWLEDGE_SUMMARY_SCHEMA,
    skipped: {
      type: "object",
      additionalProperties: false,
      required: ["oversized", "extension", "directories"],
      properties: {
        oversized: { type: "integer", minimum: 0 },
        extension: { type: "integer", minimum: 0 },
        directories: { type: "integer", minimum: 0 },
      },
    },
  },
};

const BUILD_INDEX_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "error",
    "status",
    "count",
    "created_at",
    "roots",
    "profile",
    "visited_files",
    "visited_dirs",
    "truncated",
    "skipped",
    "knowledge_summary",
  ],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string", enum: ["built", "error"] },
    count: { type: "integer", minimum: 0 },
    created_at: { type: "string" },
    roots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["alias", "path", "primary"],
        properties: {
          alias: { type: "string" },
          path: { type: "string" },
          primary: { type: "boolean" },
        },
      },
    },
    scope: INDEX_SCOPE_SCHEMA,
    profile: { type: "string" },
    visited_files: { type: "integer", minimum: 0 },
    visited_dirs: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    max_files: { type: "integer", minimum: 0 },
    max_dirs: { type: "integer", minimum: 0 },
    knowledge_summary: KNOWLEDGE_SUMMARY_SCHEMA,
    skipped: {
      type: "object",
      additionalProperties: false,
      required: ["oversized", "extension", "directories"],
      properties: {
        oversized: { type: "integer", minimum: 0 },
        extension: { type: "integer", minimum: 0 },
        directories: { type: "integer", minimum: 0 },
      },
    },
  },
};

const SEARCH_INDEX_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", ...INDEX_RETRIEVAL_METADATA_REQUIRED, "results"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    ...INDEX_RETRIEVAL_METADATA_PROPERTIES,
    results: { type: "array", items: INDEX_DOC_SCHEMA },
  },
};

const SEARCH_INDEX_CONTEXT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", ...INDEX_RETRIEVAL_METADATA_REQUIRED, "results"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    ...INDEX_RETRIEVAL_METADATA_PROPERTIES,
    results: { type: "array", items: INDEX_CONTEXT_DOC_SCHEMA },
  },
};

const COLLECT_CONTEXT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", ...INDEX_RETRIEVAL_METADATA_REQUIRED, "files"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    ...INDEX_RETRIEVAL_METADATA_PROPERTIES,
    files: { type: "array", items: COLLECT_CONTEXT_FILE_SCHEMA },
  },
};

const COLLECT_ROMIONSIM_CONTEXT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", "scope", "mode", ...INDEX_RETRIEVAL_METADATA_REQUIRED, "count", "files"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    scope: { type: "string" },
    mode: { type: "string" },
    ...INDEX_RETRIEVAL_METADATA_PROPERTIES,
    count: { type: "integer", minimum: 0 },
    files: { type: "array", items: INDEX_DOC_SCHEMA },
  },
};

module.exports = {
  BUILD_INDEX_INPUT_SCHEMA,
  BUILD_INDEX_OUTPUT_SCHEMA,
  COLLECT_CONTEXT_INPUT_SCHEMA,
  COLLECT_CONTEXT_OUTPUT_SCHEMA,
  COLLECT_ROMIONSIM_CONTEXT_INPUT_SCHEMA,
  COLLECT_ROMIONSIM_CONTEXT_OUTPUT_SCHEMA,
  INDEX_STATUS_INPUT_SCHEMA,
  INDEX_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
  STATE_CHANGING_WORKSPACE_INDEX_ANNOTATIONS,
  SEARCH_INDEX_CONTEXT_INPUT_SCHEMA,
  SEARCH_INDEX_CONTEXT_OUTPUT_SCHEMA,
  SEARCH_INDEX_INPUT_SCHEMA,
  SEARCH_INDEX_OUTPUT_SCHEMA,
};
