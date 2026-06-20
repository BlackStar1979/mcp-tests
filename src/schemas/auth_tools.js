"use strict";

const EMPTY_AUTH_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

const READ_ONLY_AUTH_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const AUTH_TRANSITION_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "mode", "current_auth_mode", "bearer_ready_for_dry_run", "bearer_ready_for_active_switch"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    mode: { type: "string" },
    current_auth_mode: { type: "string" },
    bearer_ready_for_dry_run: { type: "boolean" },
    bearer_ready_for_active_switch: { type: "boolean" },
  },
};

const AUTH_BEARER_DRY_RUN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "mode", "version", "missing_rejected_401", "invalid_rejected_401", "valid_accepted_200"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    mode: { type: "string" },
    version: { type: "string" },
    missing_rejected_401: { type: "boolean" },
    invalid_rejected_401: { type: "boolean" },
    valid_accepted_200: { type: "boolean" },
  },
};

const AUTH_BEARER_CUTOVER_GUARD_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "mode", "version", "cutover_allowed_now", "bearer_dry_run_success"],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    mode: { type: "string" },
    version: { type: "string" },
    cutover_allowed_now: { type: "boolean" },
    bearer_dry_run_success: { type: "boolean" },
  },
};

const AUTH_MODULAR_PARITY_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "mode",
    "version",
    "access_cloudflare_ready",
    "bearer_header_ready",
    "bearer_query_ready",
  ],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    mode: { type: "string" },
    version: { type: "string" },
    access_cloudflare_ready: { type: "boolean" },
    bearer_header_ready: { type: "boolean" },
    bearer_query_ready: { type: "boolean" },
  },
};

module.exports = {
  AUTH_BEARER_CUTOVER_GUARD_OUTPUT_SCHEMA,
  AUTH_BEARER_DRY_RUN_OUTPUT_SCHEMA,
  AUTH_MODULAR_PARITY_STATUS_OUTPUT_SCHEMA,
  AUTH_TRANSITION_STATUS_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
};
