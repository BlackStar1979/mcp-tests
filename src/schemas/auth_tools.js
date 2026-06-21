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

const AUTH_LEGACY_RETIREMENT_STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "mode",
    "version",
    "active_auth_modes",
    "active_ports",
    "retired_auth_modes",
    "retired_ports",
    "legacy_tools_replaced",
    "stage",
    "connector_refresh_required",
    "message",
  ],
  properties: {
    success: { type: "boolean" },
    error: { type: "string" },
    mode: { type: "string" },
    version: { type: "string" },
    active_auth_modes: { type: "array", items: { type: "string" } },
    active_ports: {
      type: "object",
      additionalProperties: false,
      required: ["none", "oauth21"],
      properties: {
        none: { type: "number" },
        oauth21: { type: "number" },
      },
    },
    retired_auth_modes: { type: "array", items: { type: "string" } },
    retired_ports: {
      type: "object",
      additionalProperties: false,
      required: ["access", "bearer"],
      properties: {
        access: { type: "number" },
        bearer: { type: "number" },
      },
    },
    legacy_non_target_modes: { type: "array", items: { type: "string" } },
    legacy_non_target_ports: {
      type: "object",
      additionalProperties: false,
      properties: {
        oauth: { type: "number" },
      },
    },
    legacy_tools_replaced: { type: "array", items: { type: "string" } },
    stage: { type: "string" },
    connector_refresh_required: { type: "boolean" },
    message: { type: "string" },
  },
};

module.exports = {
  AUTH_LEGACY_RETIREMENT_STATUS_OUTPUT_SCHEMA,
  AUTH_BEARER_CUTOVER_GUARD_OUTPUT_SCHEMA,
  AUTH_BEARER_DRY_RUN_OUTPUT_SCHEMA,
  AUTH_MODULAR_PARITY_STATUS_OUTPUT_SCHEMA,
  AUTH_TRANSITION_STATUS_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
};
