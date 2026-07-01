const assert = require("node:assert/strict");
const { diffToolLists } = require("../src/tools_list_diff");
const { runListChangedHarness } = require("../src/list_changed_harness");
const {
  LIST_CHANGED_RECEIPT_VERSION,
  buildListChangedAuditReceipt,
  verifyListChangedAuditReceipt,
} = require("../src/list_changed_audit_receipt");

const diff = diffToolLists({ current: ["a", "b"], target: ["b", "c"] });

const dryRunHarness = runListChangedHarness({
  diff,
  capabilities: { tools: { listChanged: false } },
  allowEmit: false,
  reason: "list_changed receipt dry run",
  correlationId: "list_changed_receipt_dry",
});
const dryRunReceipt = buildListChangedAuditReceipt({
  harnessResult: dryRunHarness,
  stage: "list-changed-audit-receipt",
  operation: "dry_run",
  operator: "test",
  reason: "audit receipt smoke",
});
assert.equal(dryRunReceipt.version, LIST_CHANGED_RECEIPT_VERSION);
assert.equal(dryRunReceipt.method, "notifications/tools/list_changed");
assert.equal(dryRunReceipt.would_notify, true);
assert.equal(dryRunReceipt.ready_to_emit_now, false);
assert.equal(dryRunReceipt.notification_emitted, false);
assert.equal(dryRunReceipt.transport_send_called, false);
assert.equal(dryRunReceipt.transport_sent_count, 0);
assert.equal(dryRunReceipt.allow_emit, false);
assert.equal(dryRunReceipt.operator_recorded, true);
assert.equal(dryRunReceipt.reason_recorded, true);
assert.equal(dryRunReceipt.raw_messages_redacted, true);
assert.equal(dryRunReceipt.raw_tool_lists_redacted, true);
assert.deepEqual(dryRunReceipt.sent_message_hashes, []);
assert.equal(verifyListChangedAuditReceipt(dryRunReceipt).success, true);

const futureHarness = runListChangedHarness({
  diff,
  capabilities: { tools: { listChanged: true } },
  allowEmit: true,
  reason: "list_changed receipt future mock",
  correlationId: "list_changed_receipt_future",
});
const futureReceipt = buildListChangedAuditReceipt({
  harnessResult: futureHarness,
  stage: "list-changed-audit-receipt",
  operation: "future_mock",
  operator: "test",
  reason: "audit receipt future mock",
});
assert.equal(futureReceipt.ready_to_emit_now, true);
assert.equal(futureReceipt.notification_emitted, true);
assert.equal(futureReceipt.transport_send_called, true);
assert.equal(futureReceipt.transport_sent_count, 1);
assert.equal(futureReceipt.sent_message_hashes.length, 1);
assert.equal(futureReceipt.raw_messages_redacted, true);
assert.equal(futureReceipt.raw_tool_lists_redacted, true);
assert.equal(verifyListChangedAuditReceipt(futureReceipt).success, true);

const tampered = { ...futureReceipt, transport_sent_count: 2 };
const tamperedResult = verifyListChangedAuditReceipt(tampered);
assert.equal(tamperedResult.success, false);
assert.ok(tamperedResult.errors.includes("receipt_hash mismatch"));

const inconsistent = { ...futureReceipt, notification_emitted: true, transport_send_called: false };
const inconsistentResult = verifyListChangedAuditReceipt(inconsistent);
assert.equal(inconsistentResult.success, false);
assert.ok(inconsistentResult.errors.includes("emitted receipt must have transport_send_called=true"));

console.log("smoke_list_changed_audit_receipt ok");
