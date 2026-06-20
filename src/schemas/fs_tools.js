const READ_ONLY_FS_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const FS_PATH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    path: {
      type: "string",
      default: ".",
      maxLength: 1000,
      description: "Path relative to the public FS sandbox root. Absolute paths and traversal are rejected.",
    },
  },
};

const FS_LIST_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    path: FS_PATH_INPUT_SCHEMA.properties.path,
    max_entries: {
      type: "integer",
      minimum: 1,
      maximum: 1000,
      default: 200,
    },
  },
};

const FS_READ_TEXT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: FS_PATH_INPUT_SCHEMA.properties.path,
    max_chars: {
      type: "integer",
      minimum: 100,
      maximum: 1048576,
      default: 65536,
    },
  },
};

const FS_READ_LINES_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "start_line", "end_line"],
  properties: {
    path: FS_PATH_INPUT_SCHEMA.properties.path,
    start_line: { type: "integer", minimum: 1, maximum: 1000000 },
    end_line: { type: "integer", minimum: 1, maximum: 1000000 },
    include_line_numbers: { type: "boolean", default: true },
    max_chars: FS_READ_TEXT_INPUT_SCHEMA.properties.max_chars,
  },
};

const FS_READ_CHUNK_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: FS_PATH_INPUT_SCHEMA.properties.path,
    offset: { type: "integer", minimum: 0, maximum: 10000000, default: 0 },
    length: { type: "integer", minimum: 1, maximum: 1048576, default: 4096 },
  },
};

const FS_ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "path", "kind", "size_bytes", "modified_ms"],
  properties: {
    name: { type: "string" },
    path: { type: "string" },
    kind: { type: "string" },
    size_bytes: { type: "integer", minimum: 0 },
    modified_ms: { type: "integer", minimum: 0 },
  },
};

const FS_LIST_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "root", "path", "entries", "truncated", "error"],
  properties: {
    success: { type: "boolean" },
    root: { type: "string" },
    path: { type: "string" },
    entries: { type: "array", items: FS_ENTRY_SCHEMA },
    truncated: { type: "boolean" },
    error: { type: "string" },
  },
};

const FS_INFO_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "name", "kind", "size_bytes", "modified_ms", "sha256", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    name: { type: "string" },
    kind: { type: "string" },
    size_bytes: { type: "integer", minimum: 0 },
    modified_ms: { type: "integer", minimum: 0 },
    sha256: { type: "string" },
    error: { type: "string" },
  },
};

const FS_READ_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "size_bytes", "chars", "truncated", "sha256", "text", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    size_bytes: { type: "integer", minimum: 0 },
    chars: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    sha256: { type: "string" },
    text: { type: "string" },
    error: { type: "string" },
  },
};

module.exports = {
  FS_INFO_OUTPUT_SCHEMA,
  FS_LIST_INPUT_SCHEMA,
  FS_LIST_OUTPUT_SCHEMA,
  FS_PATH_INPUT_SCHEMA,
  FS_READ_CHUNK_INPUT_SCHEMA,
  FS_READ_LINES_INPUT_SCHEMA,
  FS_READ_OUTPUT_SCHEMA,
  FS_READ_TEXT_INPUT_SCHEMA,
  READ_ONLY_FS_ANNOTATIONS,
};
