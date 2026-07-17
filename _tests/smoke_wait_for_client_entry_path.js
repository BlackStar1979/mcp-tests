"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "_workflow", "scripts", "wait_for_client_entry_path.js");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wait-client-entry-"));
const auditLog = path.join(tempRoot, "audit.jsonl");

fs.writeFileSync(auditLog, [
  JSON.stringify({ ts: "2026-07-17T16:00:00.000Z", event: "server_start", server_start_id: "old-start" }),
  JSON.stringify({ ts: "2026-07-17T16:00:01.000Z", event: "initialize_received", server_start_id: "old-start", request_id: "old-1", client_name: "other-client", client_version: "1.0.0", protocol_version: "2025-06-18" }),
].join("\n") + "\n", "utf8");

const child = cp.spawn(process.execPath, [
  SCRIPT,
  `--audit-log=${auditLog}`,
  "--client-name=codex-mcp-client",
  "--evidence-scope=operational",
  "--timeout-ms=5000",
  "--poll-ms=50",
], {
  cwd: ROOT,
  env: { ...process.env, MCP_TEST_AUDIT_LOG: auditLog },
  stdio: ["ignore", "pipe", "pipe"],
});

setTimeout(() => {
  fs.appendFileSync(auditLog, [
    JSON.stringify({ ts: "9999-12-31T00:00:00.000Z", event: "server_start", server_start_id: "current-start" }),
    JSON.stringify({ ts: "9999-12-31T00:00:00.100Z", event: "rpc_received", server_start_id: "current-start", method: "initialize" }),
    JSON.stringify({ ts: "9999-12-31T00:00:00.200Z", event: "initialize_received", server_start_id: "current-start", request_id: "new-1", client_name: "codex-mcp-client", client_version: "0.145.0-alpha.18", protocol_version: "2025-06-18" }),
    JSON.stringify({ ts: "9999-12-31T00:00:00.300Z", event: "rpc_response_sent", server_start_id: "current-start", request_id: "new-1", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 123 }),
  ].join("\n") + "\n", "utf8");
}, 150);

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => { stderr += chunk; });

child.on("exit", (code) => {
  try {
    assert.equal(code, 0, `unexpected exit ${code}: ${stderr}`);
    const payload = JSON.parse(stdout);
    assert.equal(payload.success, true);
    assert.equal(payload.marker, "wait_for_client_entry_path");
    assert.equal(payload.mode, "wait-for-client-entry-path");
    assert.equal(payload.observed_entry.entry_path, "initialize");
    assert.equal(payload.matching_client.client_name, "codex-mcp-client");
    assert.equal(payload.matching_client.client_version, "0.145.0-alpha.18");
    assert.equal(payload.report.diagnostics.status, "initialize_only");
    assert.equal(payload.report.diagnostics.initialize_retirement_readiness.status, "blocked_initialize_only_current_window");
    assert.equal(payload.report.current_server_start_id, "current-start");
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.log("smoke_wait_for_client_entry_path ok");
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  }
});
