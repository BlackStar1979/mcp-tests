const READ_ONLY_WORKSPACE_FS_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const WORKSPACE_PATH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      description: "Path inside configured workspace roots. Bare paths resolve under the primary work root; @alias/... selects an explicit extra root.",
    },
  },
};

const WORKSPACE_LIST_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    path: {
      type: "string",
      default: ".",
      maxLength: 1000,
      description: WORKSPACE_PATH_INPUT_SCHEMA.properties.path.description,
    },
  },
};

const WORKSPACE_READ_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: WORKSPACE_PATH_INPUT_SCHEMA.properties.path,
    max_chars: {
      type: "integer",
      minimum: 1000,
      maximum: 100000,
      default: 30000,
    },
  },
};

const WORKSPACE_READ_LINES_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "start_line", "end_line"],
  properties: {
    path: WORKSPACE_PATH_INPUT_SCHEMA.properties.path,
    start_line: { type: "integer", minimum: 1, maximum: 1000000 },
    end_line: { type: "integer", minimum: 1, maximum: 1000000 },
    include_line_numbers: { type: "boolean", default: true },
    max_chars: {
      type: "integer",
      minimum: 1000,
      maximum: 100000,
      default: 50000,
    },
  },
};

const WORKSPACE_READ_CHUNK_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: WORKSPACE_PATH_INPUT_SCHEMA.properties.path,
    offset: { type: "integer", minimum: 0, maximum: 10000000, default: 0 },
    length: { type: "integer", minimum: 1, maximum: 100000, default: 50000 },
  },
};

const WORKSPACE_FILE_INFO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "type", "size", "created", "modified", "root_alias"],
  properties: {
    path: { type: "string" },
    type: { type: "string", enum: ["file", "directory"] },
    size: { type: "integer", minimum: 0 },
    created: { type: "string" },
    modified: { type: "string" },
    root_alias: { type: "string" },
  },
};

const WORKSPACE_GET_INFO_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "type", "size", "created", "modified", "root_alias", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    type: WORKSPACE_FILE_INFO_SCHEMA.properties.type,
    size: WORKSPACE_FILE_INFO_SCHEMA.properties.size,
    created: { type: "string" },
    modified: { type: "string" },
    root_alias: { type: "string" },
    error: { type: "string" },
  },
};

const WORKSPACE_LIST_DIRECTORY_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "root_alias", "count", "entries", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    count: { type: "integer", minimum: 0 },
    entries: { type: "array", items: WORKSPACE_FILE_INFO_SCHEMA },
    error: { type: "string" },
  },
};

const WORKSPACE_READ_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "path",
    "root_alias",
    "bytes",
    "chars",
    "returned_chars",
    "total_lines",
    "truncated",
    "text",
    "error",
  ],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    chars: { type: "integer", minimum: 0 },
    returned_chars: { type: "integer", minimum: 0 },
    total_lines: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    text: { type: "string" },
    hint: { type: "string" },
    error: { type: "string" },
  },
};

const WORKSPACE_READ_LINES_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "path",
    "root_alias",
    "bytes",
    "start_line",
    "end_line",
    "effective_start_line",
    "effective_end_line",
    "total_lines",
    "returned_lines",
    "include_line_numbers",
    "returned_chars",
    "truncated",
    "text",
    "lines",
    "error",
  ],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    start_line: { type: "integer", minimum: 1 },
    end_line: { type: "integer", minimum: 1 },
    effective_start_line: { type: "integer", minimum: 1 },
    effective_end_line: { type: ["integer", "null"], minimum: 1 },
    total_lines: { type: "integer", minimum: 0 },
    returned_lines: { type: "integer", minimum: 0 },
    include_line_numbers: { type: "boolean" },
    returned_chars: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    text: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line", "text"],
        properties: {
          line: { type: "integer", minimum: 1 },
          text: { type: "string" },
        },
      },
    },
    error: { type: "string" },
  },
};

const WORKSPACE_READ_CHUNK_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "path",
    "root_alias",
    "bytes",
    "chars",
    "offset",
    "length",
    "returned_chars",
    "next_offset",
    "has_more",
    "text",
    "error",
  ],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    chars: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
    length: { type: "integer", minimum: 1 },
    returned_chars: { type: "integer", minimum: 0 },
    next_offset: { type: "integer", minimum: 0 },
    has_more: { type: "boolean" },
    text: { type: "string" },
    error: { type: "string" },
  },
};

module.exports = {
  READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  WORKSPACE_FILE_INFO_SCHEMA,
  WORKSPACE_GET_INFO_OUTPUT_SCHEMA,
  WORKSPACE_LIST_DIRECTORY_OUTPUT_SCHEMA,
  WORKSPACE_LIST_INPUT_SCHEMA,
  WORKSPACE_PATH_INPUT_SCHEMA,
  WORKSPACE_READ_CHUNK_INPUT_SCHEMA,
  WORKSPACE_READ_CHUNK_OUTPUT_SCHEMA,
  WORKSPACE_READ_FILE_INPUT_SCHEMA,
  WORKSPACE_READ_FILE_OUTPUT_SCHEMA,
  WORKSPACE_READ_LINES_INPUT_SCHEMA,
  WORKSPACE_READ_LINES_OUTPUT_SCHEMA,
};
