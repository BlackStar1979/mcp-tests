"use strict";

const REMOTE_SITE_READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const REMOTE_SITE_MUTATION_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const VPS_CONFIG_REF = {
  type: "string",
  minLength: 1,
  maxLength: 4096,
  description: "Absolute path to a local JSON config file containing bounded SFTP access settings for the remote site.",
};

const REMOTE_PATH = {
  type: "string",
  minLength: 1,
  maxLength: 4096,
  description: "Relative POSIX-style path under the configured remote site root.",
};

const REMOTE_SITE_FILE_ENTRY = {
  type: "object",
  additionalProperties: true,
  required: ["type", "name"],
  properties: {
    type: { type: "string" },
    name: { type: "string" },
    size: { type: "integer", minimum: 0 },
    modifyTime: { type: "integer", minimum: 0 },
    accessTime: { type: "integer", minimum: 0 },
    rights: {
      type: "object",
      additionalProperties: false,
      properties: {
        user: { type: "string" },
        group: { type: "string" },
        other: { type: "string" },
      },
    },
    owner: { type: "integer", minimum: 0 },
    group: { type: "integer", minimum: 0 },
    longname: { type: "string" },
  },
};

const REMOTE_SITE_WARNING = {
  type: "object",
  additionalProperties: true,
  required: ["code"],
  properties: {
    code: { type: "string" },
    message: { type: "string" },
  },
};

const REMOTE_SITE_RUNTIME_SUMMARY = {
  type: "object",
  additionalProperties: true,
  required: ["generated_at", "referenced_artifacts_count", "invalid_metadata_records", "invalid_inventory_entries", "purge_candidates"],
  properties: {
    generated_at: { type: "string" },
    referenced_artifacts_count: { type: "integer", minimum: 0 },
    invalid_metadata_records: { type: "integer", minimum: 0 },
    invalid_inventory_entries: { type: "integer", minimum: 0 },
    purge_candidates: { type: "integer", minimum: 0 },
  },
};

const LIST_REMOTE_SITE_FILES_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
    remote_path: {
      type: "string",
      minLength: 1,
      maxLength: 4096,
      default: ".",
      description: "Relative directory path under the configured remote site root. '.' means the site root itself.",
    },
  },
};

const LIST_REMOTE_SITE_FILES_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "remote_path", "count", "entries", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    remote_path: { type: "string" },
    count: { type: "integer", minimum: 0 },
    entries: { type: "array", items: REMOTE_SITE_FILE_ENTRY },
    error: { type: "string" },
  },
};

const READ_REMOTE_SITE_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref", "remote_path"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
    remote_path: REMOTE_PATH,
  },
};

const READ_REMOTE_SITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "remote_path", "bytes", "text", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    remote_path: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    text: { type: "string" },
    error: { type: "string" },
  },
};

const WRITE_REMOTE_SITE_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref", "remote_path", "content"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
    remote_path: REMOTE_PATH,
    content: {
      type: "string",
      maxLength: 262144,
      description: "UTF-8 text content to create or overwrite at the bounded remote path.",
    },
  },
};

const WRITE_REMOTE_SITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "remote_path", "bytes", "diff_created", "metadata_path", "operation_id", "correlation_id", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    remote_path: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    diff_created: { type: "boolean" },
    metadata_path: { type: "string" },
    operation_id: { type: "string" },
    correlation_id: { type: "string" },
    error: { type: "string" },
  },
};

const EDIT_REMOTE_SITE_FILE_INPUT_SCHEMA = WRITE_REMOTE_SITE_FILE_INPUT_SCHEMA;

const EDIT_REMOTE_SITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "remote_path", "bytes", "diff", "metadata_path", "operation_id", "correlation_id", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    remote_path: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    diff: { type: "string" },
    metadata_path: { type: "string" },
    operation_id: { type: "string" },
    correlation_id: { type: "string" },
    error: { type: "string" },
  },
};

const DELETE_REMOTE_SITE_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref", "remote_path"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
    remote_path: REMOTE_PATH,
  },
};

const DELETE_REMOTE_SITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "remote_path", "trash_path", "metadata_path", "operation_id", "correlation_id", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    remote_path: { type: "string" },
    trash_path: { type: "string" },
    metadata_path: { type: "string" },
    operation_id: { type: "string" },
    correlation_id: { type: "string" },
    error: { type: "string" },
  },
};

const MOVE_REMOTE_SITE_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref", "source_path", "target_path"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
    source_path: REMOTE_PATH,
    target_path: REMOTE_PATH,
  },
};

const MOVE_REMOTE_SITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "source_path", "target_path", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    source_path: { type: "string" },
    target_path: { type: "string" },
    error: { type: "string" },
  },
};

const RESTORE_REMOTE_SITE_FILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref", "operation_id"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
    operation_id: {
      type: "string",
      minLength: 1,
      maxLength: 512,
      description: "Delete-operation metadata operation_id used to restore a remote-site file from trash.",
    },
  },
};

const RESTORE_REMOTE_SITE_FILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "remote_path", "restored_from", "restored_to", "source_operation_id", "restore_operation_id", "correlation_id", "restore_metadata_path", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    remote_path: { type: "string" },
    restored_from: { type: "string" },
    restored_to: { type: "string" },
    source_operation_id: { type: "string" },
    restore_operation_id: { type: "string" },
    correlation_id: { type: "string" },
    restore_metadata_path: { type: "string" },
    error: { type: "string" },
  },
};

const REMOTE_SITE_RUNTIME_STATUS_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
  },
};

const REMOTE_SITE_RUNTIME_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "status", "generated_at", "inventory", "metadata", "logs", "warnings", "text", "error"],
  properties: {
    success: { type: "boolean" },
    status: { type: "string" },
    generated_at: { type: "string" },
    inventory: { type: "object", additionalProperties: true },
    metadata: { type: "object", additionalProperties: true },
    logs: { type: "object", additionalProperties: true },
    warnings: { type: "array", items: REMOTE_SITE_WARNING },
    text: { type: "string" },
    error: { type: "string" },
  },
};

const PREVIEW_REMOTE_SITE_RETENTION_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vps_config_ref"],
  properties: {
    vps_config_ref: VPS_CONFIG_REF,
  },
};

const PREVIEW_REMOTE_SITE_RETENTION_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "mode", "purge_count", "summary", "text", "error"],
  properties: {
    success: { type: "boolean" },
    mode: { type: "string" },
    purge_count: { type: "integer", minimum: 0 },
    summary: REMOTE_SITE_RUNTIME_SUMMARY,
    text: { type: "string" },
    error: { type: "string" },
  },
};

module.exports = {
  DELETE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  DELETE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  EDIT_REMOTE_SITE_FILE_INPUT_SCHEMA,
  EDIT_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  LIST_REMOTE_SITE_FILES_INPUT_SCHEMA,
  LIST_REMOTE_SITE_FILES_OUTPUT_SCHEMA,
  MOVE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  MOVE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  PREVIEW_REMOTE_SITE_RETENTION_INPUT_SCHEMA,
  PREVIEW_REMOTE_SITE_RETENTION_OUTPUT_SCHEMA,
  READ_REMOTE_SITE_FILE_INPUT_SCHEMA,
  READ_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  REMOTE_SITE_READ_ONLY_ANNOTATIONS,
  REMOTE_SITE_MUTATION_ANNOTATIONS,
  REMOTE_SITE_RUNTIME_STATUS_INPUT_SCHEMA,
  REMOTE_SITE_RUNTIME_STATUS_OUTPUT_SCHEMA,
  RESTORE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  RESTORE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  WRITE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  WRITE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
};
