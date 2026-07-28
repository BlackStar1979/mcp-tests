"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "_workflow", "scripts", "client_entry_path_report.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "client-entry-path-report-"));
const auditLog = path.join(tempRoot, "audit.jsonl");

const fixture = [
  { ts: "2026-07-13T17:41:59.000Z", event: "server_start", server_start_id: "old-start" },
  { ts: "2026-07-13T17:42:00.000Z", event: "initialize_received", server_start_id: "old-start", request_id: "old-1", client_name: "codex-mcp-client", client_version: "0.144.1", protocol_version: "2025-06-18" },
  { ts: "2026-07-13T17:42:01.000Z", event: "server_start", server_start_id: "current-start" },
  { ts: "2026-07-13T17:42:02.000Z", event: "rpc_received", server_start_id: "current-start", method: "initialize" },
  { ts: "2026-07-13T17:42:02.100Z", event: "initialize_received", server_start_id: "current-start", request_id: "r1", client_name: "codex-mcp-client", client_version: "0.144.2", protocol_version: "2025-06-18" },
  { ts: "2026-07-13T17:42:02.200Z", event: "rpc_response_sent", server_start_id: "current-start", request_id: "r1", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 123 },
  { ts: "2026-07-13T17:42:03.000Z", event: "rpc_received", server_start_id: "current-start", method: "notifications/initialized" },
  { ts: "2026-07-13T17:42:04.000Z", event: "rpc_received", server_start_id: "current-start", method: "tools/list" },
  { ts: "2026-07-13T17:42:05.000Z", event: "rpc_received", server_start_id: "current-start", method: "tools/call" },
  { ts: "2026-07-13T17:42:06.000Z", event: "server_discover_received", server_start_id: "current-start", request_id: "r2", client_name: "claude", client_version: "1.0.0", protocol_version: "2025-06-18" },
  { ts: "2026-07-13T17:42:06.100Z", event: "rpc_response_sent", server_start_id: "current-start", request_id: "r2", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 321 },
  { ts: "2026-07-13T17:42:07.000Z", event: "rpc_received", server_start_id: "current-start", method: "server/discover" }
];

fs.writeFileSync(auditLog, fixture.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");

const report = JSON.parse(cp.execFileSync(process.execPath, [SCRIPT, `--audit-log=${auditLog}`], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(report.success, true);
assert.equal(report.mode, "client-entry-path-report");
assert.equal(report.audit_log.exists, true);
assert.equal(report.current_server_start_id, "current-start");
assert.equal(report.latest_entry_server_start.server_start_id, "current-start");
assert.equal(report.filter.latest_entry_window, false);
assert.equal(report.current_window_rpc_counts.initialize, 1);
assert.equal(report.current_window_rpc_counts.server_discover, 1);
assert.equal(report.current_window_rpc_counts.notifications_initialized, 1);
assert.equal(report.current_window_rpc_counts.tools_list, 1);
assert.equal(report.current_window_rpc_counts.tools_call, 1);
assert.equal(report.diagnostics.status, "mixed_initialize_and_server_discover");
assert.equal(report.diagnostics.current_window_counts.initialize_received, 1);
assert.equal(report.diagnostics.current_window_counts.server_discover_received, 1);
assert.equal(report.diagnostics.current_window_counts.initialize_response_success, 1);
assert.equal(report.diagnostics.current_window_counts.initialize_response_error, 0);
assert.equal(report.diagnostics.current_window_counts.server_discover_response_success, 1);
assert.equal(report.diagnostics.current_window_counts.server_discover_response_error, 0);
assert.equal(report.diagnostics.followup_traffic_without_fresh_entry, false);
assert.equal(report.diagnostics.initialize_retirement_readiness.status, "mixed_current_window_hold");
assert.equal(report.retirement_evidence_summary.status, "blocked_by_operational_initialize_clients");
assert.equal(report.matching_clients[0].client_name, "claude");
assert.equal(report.matching_clients[0].status, "server_discover_only");
assert.equal(report.matching_clients[0].client_class, "synthetic_validation");
assert.equal(report.matching_clients[1].client_name, "codex-mcp-client");
assert.equal(report.matching_clients[1].client_version, "0.144.2");
assert.equal(report.matching_clients[1].status, "initialize_only");
assert.equal(report.matching_clients[1].client_class, "operational_known");
assert.equal(report.retirement_evidence_summary.operational_initialize_only_clients[0], "codex-mcp-client 0.144.2");
assert.equal(report.retirement_evidence_summary.synthetic_server_discover_only_clients[0], "claude 1.0.0");

const filtered = JSON.parse(cp.execFileSync(process.execPath, [SCRIPT, `--audit-log=${auditLog}`, "--client-name=codex-mcp-client"], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(filtered.matching_clients.length, 1);
assert.equal(filtered.matching_clients[0].client_name, "codex-mcp-client");
assert.equal(filtered.matching_clients[0].client_version, "0.144.2");
assert.equal(filtered.diagnostics.initialize_retirement_readiness.status, "mixed_current_window_hold");
assert.equal(filtered.retirement_evidence_summary.status, "blocked_by_operational_initialize_clients");

const operationalOnly = JSON.parse(cp.execFileSync(process.execPath, [SCRIPT, `--audit-log=${auditLog}`, "--evidence-scope=operational"], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(operationalOnly.filter.evidence_scope, "operational");
assert.equal(operationalOnly.matching_clients.length, 1);
assert.equal(operationalOnly.matching_clients[0].client_name, "codex-mcp-client");
assert.equal(operationalOnly.matching_clients[0].client_class, "operational_known");
assert.equal(operationalOnly.latest_matching_clients_any_window.every((item) => item.client_class === "operational_known"), true);

const syntheticOnly = JSON.parse(cp.execFileSync(process.execPath, [SCRIPT, `--audit-log=${auditLog}`, "--evidence-scope=synthetic"], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(syntheticOnly.filter.evidence_scope, "synthetic");
assert.equal(syntheticOnly.matching_clients.length, 1);
assert.equal(syntheticOnly.matching_clients[0].client_name, "claude");
assert.equal(syntheticOnly.matching_clients[0].client_class, "synthetic_validation");
assert.equal(syntheticOnly.latest_matching_clients_any_window.every((item) => item.client_class === "synthetic_validation"), true);

const recentOnly = JSON.parse(cp.execFileSync(process.execPath, [SCRIPT, `--audit-log=${auditLog}`, "--max-age-days=0"], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(recentOnly.filter.max_age_days, 0);
assert.equal(recentOnly.filter.retained_evidence_since_ts, "2026-07-13T17:42:07.000Z");
assert.equal(recentOnly.latest_matching_clients_any_window.length, 0);
assert.equal(recentOnly.retirement_evidence_summary.status, "insufficient_evidence");

const contaminatedAuditLog = path.join(tempRoot, "contaminated-audit.jsonl");
const contaminatedFixture = [
  ...fixture.map((entry) => {
    if (entry.event !== "rpc_received") return entry;
    const { server_start_id: _omittedServerStartId, ...withoutServerStartId } = entry;
    return withoutServerStartId;
  }),
  { ts: "2026-07-13T17:42:08.000Z", event: "server_start", server_start_id: "test-start", port: 51999, public_base_url: "http://127.0.0.1:51999" },
  { ts: "2026-07-13T17:42:09.000Z", event: "rpc_received", server_start_id: "test-start", method: "tools/call" },
];
fs.writeFileSync(contaminatedAuditLog, contaminatedFixture.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");

const explicitLiveWindow = JSON.parse(cp.execFileSync(process.execPath, [
  SCRIPT,
  `--audit-log=${contaminatedAuditLog}`,
  "--server-start-id=current-start",
], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: contaminatedAuditLog },
  encoding: "utf8",
}));

assert.equal(explicitLiveWindow.current_server_start_id, "current-start");
assert.equal(explicitLiveWindow.current_server_start_ts, "2026-07-13T17:42:01.000Z");
assert.equal(explicitLiveWindow.current_window_rpc_counts.initialize, 1);
assert.equal(explicitLiveWindow.current_window_rpc_counts.server_discover, 1);
assert.equal(explicitLiveWindow.current_window_rpc_counts.tools_call, 1);
assert.equal(explicitLiveWindow.diagnostics.status, "mixed_initialize_and_server_discover");
assert.equal(explicitLiveWindow.filter.server_start_id, "current-start");

const latestEntryWindow = JSON.parse(cp.execFileSync(process.execPath, [
  SCRIPT,
  `--audit-log=${contaminatedAuditLog}`,
  "--latest-entry-window",
  "--evidence-scope=operational",
], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: contaminatedAuditLog },
  encoding: "utf8",
}));

assert.equal(latestEntryWindow.current_server_start_id, "current-start");
assert.equal(latestEntryWindow.current_server_start_ts, "2026-07-13T17:42:01.000Z");
assert.equal(latestEntryWindow.latest_entry_server_start.server_start_id, "current-start");
assert.equal(latestEntryWindow.current_window_rpc_counts.initialize, 1);
assert.equal(latestEntryWindow.current_window_rpc_counts.server_discover, 1);
assert.equal(latestEntryWindow.diagnostics.status, "mixed_initialize_and_server_discover");
assert.equal(latestEntryWindow.filter.latest_entry_window, true);
assert.equal(latestEntryWindow.filter.evidence_scope, "operational");

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("smoke_client_entry_path_report_script ok");
