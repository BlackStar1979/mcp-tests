"use strict";

const STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

const WORKSPACE_MUTATION_PATH_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: 1000,
  description: "Path inside configured workspace roots. Bare paths resolve under the primary work root; @alias/... selects an explicit extra root.",
};

const WRITE_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "content"],
  properties: {
    path: WORKSPACE_MUTATION_PATH_SCHEMA,
    content: { type: "string" },
    allow_protected: { type: "boolean", default: false },
  },
};

const APPEND_FILE_INPUT_SCHEMA = WRITE_FILE_INPUT_SCHEMA;

const COPY_PATH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["from", "to"],
  properties: {
    from: WORKSPACE_MUTATION_PATH_SCHEMA,
    to: WORKSPACE_MUTATION_PATH_SCHEMA,
    allow_protected: { type: "boolean", default: false },
  },
};

const MOVE_PATH_INPUT_SCHEMA = COPY_PATH_INPUT_SCHEMA;

const DELETE_PATH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: WORKSPACE_MUTATION_PATH_SCHEMA,
    allow_protected: { type: "boolean", default: false },
  },
};

const RESTORE_PATH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["trash_path"],
  properties: {
    trash_path: WORKSPACE_MUTATION_PATH_SCHEMA,
    destination: { type: "string", maxLength: 1000 },
    overwrite: { type: "boolean", default: false },
    allow_protected: { type: "boolean", default: false },
  },
};

const EDIT_FILE_PATCH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path", "anchor", "content"],
  properties: {
    path: WORKSPACE_MUTATION_PATH_SCHEMA,
    anchor: { type: "string", minLength: 1 },
    content: { type: "string" },
    mode: { type: "string", enum: ["before", "after", "replace"], default: "replace" },
    dry_run: { type: "boolean", default: true },
    allow_protected: { type: "boolean", default: false },
    require_markers: {
      type: "array",
      default: [],
      items: { type: "string", minLength: 1, maxLength: 1000 },
    },
  },
};

const WRITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "path", "bytes", "backup"],
  properties: {
    status: { type: "string", enum: ["written"] },
    path: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    backup: { type: ["string", "null"] },
  },
};

const APPEND_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "path", "bytes", "backup"],
  properties: {
    status: { type: "string", enum: ["appended"] },
    path: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    backup: { type: ["string", "null"] },
  },
};

const COPY_PATH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "from", "to", "backup"],
  properties: {
    status: { type: "string", enum: ["copied"] },
    from: { type: "string" },
    to: { type: "string" },
    backup: { type: ["string", "null"] },
  },
};

const MOVE_PATH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "from", "to"],
  properties: {
    status: { type: "string", enum: ["moved"] },
    from: { type: "string" },
    to: { type: "string" },
  },
};

const DELETE_PATH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "from", "to", "metadata"],
  properties: {
    status: { type: "string", enum: ["moved_to_trash"] },
    from: { type: "string" },
    to: { type: "string" },
    metadata: { type: "string" },
  },
};

const RESTORE_PATH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "from", "to", "warnings"],
  properties: {
    status: { type: "string", enum: ["restored"] },
    from: { type: "string" },
    to: { type: "string" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const EDIT_FILE_PATCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "path", "mode", "anchor_matches", "bytes_before", "bytes_after", "delta_bytes", "dry_run", "backup"],
  properties: {
    status: { type: "string", enum: ["dry_run", "patched"] },
    path: { type: "string" },
    mode: { type: "string", enum: ["before", "after", "replace"] },
    anchor_matches: { type: "integer", minimum: 1 },
    bytes_before: { type: "integer", minimum: 0 },
    bytes_after: { type: "integer", minimum: 0 },
    delta_bytes: { type: "integer" },
    dry_run: { type: "boolean" },
    backup: { type: ["string", "null"] },
  },
};

module.exports = {
  APPEND_FILE_INPUT_SCHEMA,
  APPEND_FILE_OUTPUT_SCHEMA,
  COPY_PATH_INPUT_SCHEMA,
  COPY_PATH_OUTPUT_SCHEMA,
  DELETE_PATH_INPUT_SCHEMA,
  DELETE_PATH_OUTPUT_SCHEMA,
  DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  EDIT_FILE_PATCH_INPUT_SCHEMA,
  EDIT_FILE_PATCH_OUTPUT_SCHEMA,
  MOVE_PATH_INPUT_SCHEMA,
  MOVE_PATH_OUTPUT_SCHEMA,
  RESTORE_PATH_INPUT_SCHEMA,
  RESTORE_PATH_OUTPUT_SCHEMA,
  STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  WRITE_FILE_INPUT_SCHEMA,
  WRITE_FILE_OUTPUT_SCHEMA,
};
