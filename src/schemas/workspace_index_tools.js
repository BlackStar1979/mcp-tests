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
  required: ["path", "score", "snippet"],
  properties: {
    path: { type: "string" },
    score: { type: "number" },
    snippet: { type: "string" },
    role: { type: "string" },
  },
};

const INDEX_CONTEXT_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "score", "context"],
  properties: {
    path: { type: "string" },
    score: { type: "number" },
    context: { type: "string" },
  },
};

const COLLECT_CONTEXT_FILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "score", "text"],
  properties: {
    path: { type: "string" },
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
  "index_truncated",
  "index_created_at",
  "index_count",
];

const INDEX_RETRIEVAL_METADATA_PROPERTIES = {
  index_scope: INDEX_SCOPE_SCHEMA,
  path_filter: { type: "string" },
  index_truncated: { type: "boolean" },
  index_created_at: { type: "string" },
  index_count: { type: "integer", minimum: 0 },
};

const INDEX_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "count", "created_at", "root", "version"],
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
    visited_files: { type: "integer", minimum: 0 },
    visited_dirs: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    max_files: { type: "integer", minimum: 0 },
    max_dirs: { type: "integer", minimum: 0 },
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
    "visited_files",
    "visited_dirs",
    "truncated",
    "skipped",
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
    visited_files: { type: "integer", minimum: 0 },
    visited_dirs: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    max_files: { type: "integer", minimum: 0 },
    max_dirs: { type: "integer", minimum: 0 },
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
