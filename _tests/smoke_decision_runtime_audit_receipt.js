"use strict";

const assert = require("node:assert/strict");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");

const RAW_SECRET = "RAW_SECRET_38H_SHOULD_NOT_APPEAR";
const audits = [];

function auditLog(event, payload = {}) {
  audits.push({ event, payload });
}

function getOptionalTool() {
  return null;
}

function findEvent(entries, event) {
  return entries.find((entry) => entry.event === event);
}

function assertNoRawSecret(value, label) {
  assert.equal(JSON.stringify(value).includes(RAW_SECRET), false, `${label} must not contain raw secret value`);
}

function assertDecisionReceipt(entry, expected) {
  assert.ok(entry, `${expected.label} decision audit must exist`);
  const receipt = entry.payload.decision_receipt;
  assert.equal(receipt.version, "decision-runtime-receipt-v1", `${expected.label} receipt version`);
  assert.equal(receipt.route, "tools/call", `${expected.label} receipt route`);
  assert.equal(receipt.decision_code, expected.decisionCode, `${expected.label} decision code`);
  assert.ok(receipt.reason_codes.includes(expected.reasonCode), `${expected.label} reason code`);
  assert.equal(receipt.redacted_context.tool, expected.tool, `${expected.label} redacted tool`);
  assert.equal(receipt.redacted_context.known_tool, false, `${expected.label} known_tool`);
  assert.equal(receipt.redacted_context.auth_mode, "bearer", `${expected.label} auth mode`);
  assert.equal(receipt.redacted_context.profile, "internal", `${expected.label} profile`);
  assert.equal(receipt.redacted_context.request_id, expected.requestId, `${expected.label} request id`);
  assert.equal(receipt.redacted_context.arg_summary.arg_key_count, expected.argKeyCount, `${expected.label} arg key count`);
  assert.equal(typeof receipt.redacted_context.arg_summary.arg_shape_sha256, "string", `${expected.label} arg shape hash`);
  assertNoRawSecret(receipt, `${expected.label} receipt`);
}

async function callAndCollect(params, requestId) {
  const start = audits.length;
  const response = await handleToolsCall({
    id: requestId,
    params,
    context: { requestId },
    outputMode: "structured",
    authMode: "bearer",
    profile: "internal",
    getOptionalTool,
    auditLog,
  });
  return { response, entries: audits.slice(start) };
}

(async () => {
  const unknown = await callAndCollect(
    {
      name: "stage12_step38h_unregistered_tool",
      arguments: {
        secret_token: RAW_SECRET,
        nested: { value: RAW_SECRET },
      },
    },
    "req-step38h-unknown"
  );

  assert.equal(unknown.response.error.code, -32602);
  assert.match(unknown.response.error.message, /Unknown tool: stage12_step38h_unregistered_tool/);
  assertDecisionReceipt(findEvent(unknown.entries, "tool_call_decision"), {
    label: "unknown-tool",
    decisionCode: "unknown_tool",
    reasonCode: "unknown_tool",
    tool: "stage12_step38h_unregistered_tool",
    requestId: "req-step38h-unknown",
    argKeyCount: 2,
  });
  const unknownError = findEvent(unknown.entries, "tool_call_error");
  assert.ok(unknownError, "unknown-tool error audit must exist");
  assert.equal(unknownError.payload.error_kind, "unknown_tool");
  assertNoRawSecret(unknown.entries, "unknown-tool audit trail");

  const malformed = await callAndCollect(
    {
      arguments: {
        secret_token: RAW_SECRET,
      },
    },
    "req-step38h-missing-name"
  );

  assert.equal(malformed.response.error.code, -32602);
  assert.match(malformed.response.error.message, /Invalid tool call decision context/);
  assertDecisionReceipt(findEvent(malformed.entries, "tool_call_decision"), {
    label: "missing-name",
    decisionCode: "missing_tool_name",
    reasonCode: "missing_tool_name",
    tool: "unknown",
    requestId: "req-step38h-missing-name",
    argKeyCount: 1,
  });
  const malformedError = findEvent(malformed.entries, "tool_call_error");
  assert.ok(malformedError, "missing-name error audit must exist");
  assert.equal(malformedError.payload.error_kind, "missing_tool_name");
  assert.equal(malformedError.payload.decision_receipt.version, "decision-runtime-receipt-v1");
  assertNoRawSecret(malformed.entries, "missing-name audit trail");

  console.log("smoke_decision_runtime_audit_receipt ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
