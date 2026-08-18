"use strict";

const MODERN_PROTOCOL_VERSION = "2026-07-28";
const CURRENT_LEGACY_PROTOCOL_VERSION = "2025-11-25";
const LEGACY_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_LEGACY_PROTOCOL_VERSIONS = Object.freeze([
  CURRENT_LEGACY_PROTOCOL_VERSION,
  "2025-06-18",
  LEGACY_PROTOCOL_VERSION,
]);
const TASKS_EXTENSION_ID = "io.modelcontextprotocol/tasks";

const MODERN_MODULES = Object.freeze({
  transport: "streamable_http_stateless",
  discovery: "server_discover",
  request_metadata: "per_request_meta",
  request_state: "explicit_state_handles",
  result_envelope: "complete_result_discriminator",
  http_headers: "standard_mcp_headers",
  cache: "cacheable_result_hints",
  schemas: "json_schema_2020_12",
  auth: "oauth21_modular_boundary",
  resources: "resource_protocol_boundary",
  trace: "w3c_trace_context",
  tasks: "tasks_extension",
  mrtr: "fixture_only",
});

const LEGACY_MODULES = Object.freeze({
  transport: "streamable_http_stateless",
  discovery: "legacy_initialize_compat",
  request_metadata: "initialize_era_metadata",
  request_state: "tool_level_state_handles_only",
  result_envelope: "legacy_result",
  http_headers: "legacy_header_contract",
  cache: "compat_cache_hints",
  schemas: "json_schema_2020_12",
  auth: "oauth21_modular_boundary",
  resources: "resource_protocol_boundary",
  trace: "w3c_trace_context",
  tasks: "not_negotiated",
  mrtr: "not_negotiated",
});

const ADAPTERS = Object.freeze({
  [MODERN_PROTOCOL_VERSION]: Object.freeze({
    version: MODERN_PROTOCOL_VERSION,
    era: "modern_2026_07_28",
    modules: MODERN_MODULES,
    extensions: Object.freeze([TASKS_EXTENSION_ID]),
  }),
  ...Object.fromEntries(SUPPORTED_LEGACY_PROTOCOL_VERSIONS.map((version) => [
    version,
    Object.freeze({
      version,
      era: "legacy_initialize_compat",
      modules: LEGACY_MODULES,
      extensions: Object.freeze([]),
    }),
  ])),
});

const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(Object.keys(ADAPTERS));

function adapterForProtocolVersion(version) {
  return ADAPTERS[String(version || "")] || null;
}

function extensionsForProtocolVersion(version) {
  const adapter = adapterForProtocolVersion(version);
  return adapter ? adapter.extensions.slice() : [];
}

module.exports = {
  ADAPTERS,
  CURRENT_LEGACY_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION,
  MODERN_PROTOCOL_VERSION,
  SUPPORTED_LEGACY_PROTOCOL_VERSIONS,
  SUPPORTED_PROTOCOL_VERSIONS,
  TASKS_EXTENSION_ID,
  adapterForProtocolVersion,
  extensionsForProtocolVersion,
};
