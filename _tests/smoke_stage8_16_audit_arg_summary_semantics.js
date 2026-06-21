const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildObservabilityStatus } = require("../src/observability_status");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-stage8-16-"));
const auditLogPath = path.join(tmpDir, "audit.jsonl");

const entries = [
  {
    ts: "2026-05-18T20:00:00.000Z",
    event: "tool_call_start",
    request_id: "new-arg-summary-failed",
    tool: "fs_read_public_text",
    arg_summary_status: "failed",
    arg_summary_error: "arg_summary",
    execution_success: "unknown",
  },
  {
    ts: "2026-05-18T20:00:00.010Z",
    event: "tool_call_end",
    request_id: "new-arg-summary-failed",
    tool: "fs_read_public_text",
    duration_ms: 3,
    is_error: false,
    success: true,
  },
  {
    ts: "2026-05-18T20:00:01.000Z",
    event: "tool_call_start",
    request_id: "legacy-arg-summary-failed",
    tool: "dev_code_symbols",
    success: false,
    error: "arg_summary",
  },
  {
    ts: "2026-05-18T20:00:01.010Z",
    event: "tool_call_end",
    request_id: "legacy-arg-summary-failed",
    tool: "dev_code_symbols",
    duration_ms: 4,
    is_error: false,
    success: true,
  },
  {
    ts: "2026-05-18T20:00:02.000Z",
    event: "tool_call_start",
    request_id: "real-execution-error",
    tool: "fetch",
    arg_summary_status: "ok",
    execution_success: "unknown",
  },
  {
    ts: "2026-05-18T20:00:02.010Z",
    event: "tool_call_end",
    request_id: "real-execution-error",
    tool: "fetch",
    duration_ms: 5,
    is_error: true,
    success: false,
  },
];

fs.writeFileSync(auditLogPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");

const runtimeStatus = {
  server_version: "0.40.0",
  stage_status: "stage8_16-audit-arg-summary-semantics",
  auth: { mode: "none" },
  profile: { mode: "public" },
  enabled_tools: ["fetch", "fs_read_public_text", "dev_code_symbols", "observability_status"],
  security_boundary: { status: "ok" },
};

const status = buildObservabilityStatus({
  args: {
    window_size: 50,
    slow_ms: 1000,
    top_n: 10,
    connector_visible_tools: runtimeStatus.enabled_tools,
  },
  runtimeStatusProvider: () => runtimeStatus,
  auditLogPath,
});

assert.equal(status.success, true);
assert.equal(status.audit_jsonl_health.parse_errors, 0);
assert.equal(status.connector_map_health.status, "in_sync");
assert.equal(status.tool_call_balance.starts, 3);
assert.equal(status.tool_call_balance.ends, 3);
assert.equal(status.tool_call_balance.orphan_start_count, 0);

assert.equal(status.audit_semantics.arg_summary_failure_count, 2);
assert.equal(status.audit_semantics.arg_summary_status_failed_count, 1);
assert.equal(status.audit_semantics.legacy_arg_summary_success_false_count, 1);
assert.equal(status.audit_semantics.execution_success_on_start, "unknown");
assert.equal(status.audit_semantics.execution_error_count, 1);
assert.equal(status.audit_semantics.success_false_markers, 2);
assert.match(status.audit_semantics.note, /arg_summary_status=failed/);
assert.match(status.audit_semantics.note, /Legacy tool_call_start success:false/);

console.log("smoke_stage8_16_audit_arg_summary_semantics ok");
