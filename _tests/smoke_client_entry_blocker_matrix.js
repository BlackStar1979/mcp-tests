"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "_workflow", "scripts", "client_entry_blocker_matrix.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "client-entry-blocker-matrix-"));
const auditLog = path.join(tempRoot, "audit.jsonl");

const fixture = [
  { ts: "2026-07-10T10:00:00.000Z", event: "server_start", server_start_id: "old-start" },
  { ts: "2026-07-10T10:00:01.000Z", event: "initialize_received", server_start_id: "old-start", request_id: "old-1", client_name: "openai-mcp", client_version: "1.0.0", protocol_version: "2025-11-25" },
  { ts: "2026-07-16T10:00:00.000Z", event: "server_start", server_start_id: "current-start" },
  { ts: "2026-07-16T10:00:01.000Z", event: "rpc_received", server_start_id: "current-start", method: "initialize" },
  { ts: "2026-07-16T10:00:01.100Z", event: "initialize_received", server_start_id: "current-start", request_id: "r1", client_name: "codex-mcp-client", client_version: "0.144.2", protocol_version: "2025-06-18" },
  { ts: "2026-07-16T10:00:01.200Z", event: "rpc_response_sent", server_start_id: "current-start", request_id: "r1", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 100 },
  { ts: "2026-07-17T10:00:00.000Z", event: "rpc_received", server_start_id: "current-start", method: "initialize" },
  { ts: "2026-07-17T10:00:00.100Z", event: "initialize_received", server_start_id: "current-start", request_id: "r2", client_name: "codex-mcp-client", client_version: "0.145.0-alpha.18", protocol_version: "2025-06-18" },
  { ts: "2026-07-17T10:00:00.200Z", event: "rpc_response_sent", server_start_id: "current-start", request_id: "r2", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 101 },
  { ts: "2026-07-17T10:00:00.300Z", event: "server_discover_received", server_start_id: "current-start", request_id: "r3", client_name: "step95-discover-smoke", client_version: "1", protocol_version: "2025-06-18" },
  { ts: "2026-07-17T10:00:00.400Z", event: "rpc_response_sent", server_start_id: "current-start", request_id: "r3", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 102 },
];

fs.writeFileSync(auditLog, fixture.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");

const matrix = JSON.parse(cp.execFileSync(process.execPath, [
  SCRIPT,
  "--audit-log", auditLog,
  "--evidence-scope", "operational",
  "--windows", "1,2,all",
], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(matrix.success, true);
assert.equal(matrix.mode, "client-entry-blocker-matrix");
assert.equal(matrix.current_window.server_start_id, "current-start");
assert.equal(matrix.current_window.diagnostics.status, "mixed_initialize_and_server_discover");
assert.equal(matrix.current_window.diagnostics.initialize_retirement_readiness.status, "mixed_current_window_hold");
assert.equal(matrix.filter.evidence_scope, "operational");
assert.equal(matrix.retained_blocker_matrix.length, 3);

const oneDay = matrix.retained_blocker_matrix.find((item) => item.label === "1d");
assert.ok(oneDay);
assert.equal(oneDay.retirement_evidence_summary.status, "blocked_by_operational_initialize_clients");
assert.deepEqual(oneDay.retirement_evidence_summary.operational_initialize_only_clients, [
  "codex-mcp-client 0.145.0-alpha.18",
  "codex-mcp-client 0.144.2",
]);

const twoDay = matrix.retained_blocker_matrix.find((item) => item.label === "2d");
assert.ok(twoDay);
assert.equal(twoDay.retirement_evidence_summary.status, "blocked_by_operational_initialize_clients");
assert.deepEqual(twoDay.retirement_evidence_summary.operational_initialize_only_clients, [
  "codex-mcp-client 0.145.0-alpha.18",
  "codex-mcp-client 0.144.2",
]);

const allWindow = matrix.retained_blocker_matrix.find((item) => item.label === "all");
assert.ok(allWindow);
assert.equal(allWindow.retirement_evidence_summary.status, "blocked_by_operational_initialize_clients");
assert.deepEqual(allWindow.retirement_evidence_summary.operational_initialize_only_clients, [
  "codex-mcp-client 0.145.0-alpha.18",
  "codex-mcp-client 0.144.2",
  "openai-mcp 1.0.0",
]);

const unknownOption = cp.spawnSync(process.execPath, [SCRIPT, "--unknown-option=value"], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
});
assert.equal(unknownOption.status, 2);
assert.equal(JSON.parse(unknownOption.stderr).error_code, "cli_argument_unknown");

const syntheticScoped = JSON.parse(cp.execFileSync(process.execPath, [
  SCRIPT,
  `--audit-log=${auditLog}`,
  "--evidence-scope=synthetic",
  "--windows=1,all",
], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  encoding: "utf8",
}));

assert.equal(syntheticScoped.retained_blocker_matrix[0].retirement_evidence_summary.status, "synthetic_server_discover_only");
assert.deepEqual(syntheticScoped.retained_blocker_matrix[0].retirement_evidence_summary.synthetic_server_discover_only_clients, ["step95-discover-smoke 1"]);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("smoke_client_entry_blocker_matrix ok");
