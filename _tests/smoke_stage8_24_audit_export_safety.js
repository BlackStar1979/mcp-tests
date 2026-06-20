const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assessAuditExportSafety } = require("../src/audit_export_safety");
const { buildObservabilityStatus } = require("../src/observability_status");
const { CURRENT_STAGE_STATUS } = require("../src/stage_metadata");

function writeAuditFixture(entries) {
  const file = path.join(os.tmpdir(), `mcp-tests-audit-export-${process.pid}-${Date.now()}.jsonl`);
  fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
  return file;
}

const safe = assessAuditExportSafety([
  { event: "tool_call_start", tool: "search", arg_sha256: "abc", arg_length_chars: 3 },
]);
assert.equal(safe.export_safe, true);
assert.equal(safe.recommended_export_mode, "raw_ok");
assert.deepEqual(safe.raw_export_blocked_reasons, []);

const unsafe = assessAuditExportSafety([
  { event: "server_start", audit_path: "C:/Work/mcp-tests/.mcp-tests-audit.jsonl" },
  { event: "tool_call_start", file: "docs/private.pem" },
  { event: "tool_call_start", note: "token-file configured" },
]);
assert.equal(unsafe.export_safe, false);
assert.equal(unsafe.recommended_export_mode, "redacted_summary_only");
assert.ok(unsafe.raw_export_blocked_reasons.includes("path_like_value_present"));
assert.ok(unsafe.raw_export_blocked_reasons.includes("sensitive_path_hint_present"));
assert.ok(unsafe.samples.every((sample) => sample.raw_value_redacted === true));
assert.ok(unsafe.samples.every((sample) => typeof sample.value_sha256_prefix === "string"));

const fixture = writeAuditFixture([
  { ts: "2026-05-19T00:00:00.000Z", event: "server_start", audit_path: "C:/Work/mcp-tests/.mcp-tests-audit.jsonl" },
  { ts: "2026-05-19T00:00:01.000Z", event: "tool_call_start", request_id: "r1", tool: "search", arg_sha256: "abc" },
  { ts: "2026-05-19T00:00:02.000Z", event: "tool_call_end", request_id: "r1", tool: "search", duration_ms: 1, is_error: false },
]);
try {
  const status = buildObservabilityStatus({
    args: { window_size: 10, slow_ms: 1000, top_n: 5 },
    auditLogPath: fixture,
    runtimeStatusProvider: () => ({
      server_version: "0.30.0",
      stage_status: CURRENT_STAGE_STATUS,
      auth: { mode: "none" },
      profile: { mode: "public" },
      enabled_tools: ["search", "observability_status"],
      tool_surface: { tool_count: 2, tool_names_hash: "abc123abc123" },
      security_boundary: { status: "ok" },
    }),
  });
  assert.equal(status.success, true);
  assert.equal(status.path_redaction_risk.audit_export_safety.export_safe, false);
  assert.equal(status.path_redaction_risk.audit_export_safety.recommended_export_mode, "redacted_summary_only");
  assert.ok(status.path_redaction_risk.audit_export_safety.raw_export_blocked_reasons.includes("path_like_value_present"));
} finally {
  fs.rmSync(fixture, { force: true });
}

console.log("smoke_stage8_24_audit_export_safety ok");
