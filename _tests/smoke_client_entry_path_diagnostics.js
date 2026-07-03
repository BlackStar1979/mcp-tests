"use strict";

const assert = require("node:assert/strict");
const { buildClientEntryPathDiagnostics } = require("../src/client_entry_path_diagnostics");

const runtimeStatus = {
  server_start_id: "start-a",
  request_contract: {
    route: "/mcp",
    post_only: true,
    initialize_required: false,
    protocol_sessions: false,
    server_discover_supported: true,
    legacy_initialize_supported: true,
    transport_mode: "streamable_http_stateless_legacy_initialize_compat",
  },
};

const initializeOnly = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "initialize_received", request_id: "r1", server_start_id: "start-a", client_name: "codex", client_version: "1", protocol_version: "2025-06-18" },
], runtimeStatus);
assert.equal(initializeOnly.status, "initialize_only");
assert.equal(initializeOnly.initialize_observed_for_current_start, true);
assert.equal(initializeOnly.server_discover_observed_for_current_start, false);

const discoverOnly = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "server_discover_received", request_id: "r2", server_start_id: "start-a", client_name: "claude", client_version: "1", protocol_version: "2025-06-18" },
], runtimeStatus);
assert.equal(discoverOnly.status, "server_discover_only");
assert.equal(discoverOnly.initialize_observed_for_current_start, false);
assert.equal(discoverOnly.server_discover_observed_for_current_start, true);

const mixed = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "initialize_received", request_id: "r1", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:02.000Z", event: "server_discover_received", request_id: "r2", server_start_id: "start-a" },
], runtimeStatus);
assert.equal(mixed.status, "mixed_initialize_and_server_discover");
assert.equal(mixed.current_window_counts.initialize_received, 1);
assert.equal(mixed.current_window_counts.server_discover_received, 1);
assert.equal(mixed.request_contract.server_discover_supported, true);

console.log("smoke_client_entry_path_diagnostics ok");
