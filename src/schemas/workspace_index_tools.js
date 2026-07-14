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
  },
};

const SEARCH_INDEX_CONTEXT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 1, maxLength: 400 },
    limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
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
    visited_files: { type: "integer", minimum: 0 },
    visited_dirs: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
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
  required: ["success", "error", "status", "query", "results"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    results: { type: "array", items: INDEX_DOC_SCHEMA },
  },
};

const SEARCH_INDEX_CONTEXT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", "results"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    results: { type: "array", items: INDEX_CONTEXT_DOC_SCHEMA },
  },
};

const COLLECT_CONTEXT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", "files"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    files: { type: "array", items: COLLECT_CONTEXT_FILE_SCHEMA },
  },
};

const COLLECT_ROMIONSIM_CONTEXT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "error", "status", "query", "scope", "mode", "count", "files"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    status: { type: "string" },
    query: { type: "string" },
    scope: { type: "string" },
    mode: { type: "string" },
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
