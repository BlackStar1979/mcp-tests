const assert = require("node:assert/strict");
const { assessAuditExportSafety } = require("../src/audit_export_safety");
const {
  AUDIT_EXPORT_REDACTOR_VERSION,
  buildRedactedAuditExport,
  classifyString,
} = require("../src/audit_export_redactor");

const rawAudit = [
  {
    event: "tool_call_start",
    tool: "fs_read_public_text",
    args: {
      path: "C:/Work/mcp-tests/docs/private.pem",
      note: "read ../server.js and token file .secrets/mcp_token.txt",
    },
  },
  {
    event: "tool_call_error",
    stderr: "failed opening /tmp/workspace/credential.key and relative/path/config.json",
    nested: {
      "C:/Work/mcp-tests/.secrets/key.txt": "sensitive key name should be redacted",
    },
  },
];

assert.equal(classifyString("C:/Work/mcp-tests/docs/private.pem").path_like, true);
assert.equal(classifyString("C:/Work/mcp-tests/docs/private.pem").path_is_absolute, true);
assert.equal(classifyString("C:/Work/mcp-tests/docs/private.pem").sensitive_path_hint, true);
assert.equal(classifyString("plain status ok").path_like, false);
assert.equal(classifyString("plain status ok").sensitive_path_hint, false);

const before = assessAuditExportSafety(rawAudit);
assert.equal(before.export_safe, false);
assert.ok(before.raw_export_blocked_reasons.includes("path_like_value_present"));
assert.ok(before.raw_export_blocked_reasons.includes("sensitive_path_hint_present"));

const exportResult = buildRedactedAuditExport(rawAudit);
assert.equal(exportResult.redactor_version, AUDIT_EXPORT_REDACTOR_VERSION);
assert.equal(exportResult.raw_export_allowed, false);
assert.equal(exportResult.raw_payload_redacted, true);
assert.equal(exportResult.before_safety.export_safe, false);
assert.equal(exportResult.success, true);
assert.equal(exportResult.after_safety.export_safe, true);
assert.equal(exportResult.after_safety.raw_path_like_value_count, 0);
assert.equal(exportResult.after_safety.sensitive_path_hint_count, 0);
assert.ok(exportResult.redaction_stats.redacted_string_count >= 4);
assert.ok(exportResult.redaction_stats.redacted_key_count >= 1);
assert.ok(exportResult.redaction_stats.path_like_value_count >= 3);
assert.ok(exportResult.redaction_stats.sensitive_path_hint_count >= 2);
assert.equal(typeof exportResult.redacted_payload_hash, "string");

const serialized = JSON.stringify(exportResult.redacted_payload);
for (const forbidden of [
  "C:/Work",
  "private.pem",
  ".secrets",
  "mcp_token",
  "credential.key",
  "relative/path/config.json",
]) {
  assert.equal(serialized.includes(forbidden), false, `redacted payload leaked ${forbidden}`);
}
assert.ok(serialized.includes("value_sha256_prefix"));
assert.ok(serialized.includes("raw_value_redacted") === false);

const safe = buildRedactedAuditExport([{ event: "tool_call_end", ok: true, tool: "search" }]);
assert.equal(safe.success, true);
assert.equal(safe.before_safety.export_safe, true);
assert.equal(safe.after_safety.export_safe, true);
assert.equal(safe.redaction_stats.redacted_string_count, 0);

console.log("smoke_audit_export_redaction_hardening ok");
