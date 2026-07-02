"use strict";

const assert = require("node:assert/strict");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");

const RAW_SECRET = "STEP39_RAW_SECRET_SHOULD_NOT_APPEAR";

function makeAuditSink() {
  const entries = [];
  return {
    entries,
    auditLog(event, payload = {}) {
      entries.push({ event, payload });
    },
  };
}

function documentRuntimeContext() {
  return {
    publicBaseUrl: "https://example.test",
    maxFetchTextChars: 200,
    connectorShapeVersion: "2025-05-strict-v1",
    docs: [
      {
        id: "decision-runtime-canary",
        title: "Decision Runtime Canary",
        text: "decision runtime canary document",
        metadata: { fixture: true },
      },
    ],
  };
}

function getOptionalTool() {
  return null;
}

function assertNoRawSecret(value, label) {
  assert.equal(JSON.stringify(value).includes(RAW_SECRET), false, `${label} must not include raw secret`);
}

function findEvent(entries, event) {
  return entries.find((entry) => entry.event === event);
}

async function callTool(params, requestId) {
  const sink = makeAuditSink();
  const response = await handleToolsCall({
    id: requestId,
    params,
    context: { requestId },
    outputMode: "structured",
    documentRuntimeContext,
    auditLog: sink.auditLog,
    authMode: "bearer",
    profile: "internal",
    getOptionalTool,
  });
  return { response, audits: sink.entries };
}

(async () => {
  const allow = await callTool(
    {
      name: "search",
      arguments: { query: `decision ${RAW_SECRET}` },
    },
    "req-step39-allow"
  );

  assert.ok(allow.response.result, "allow path must return JSON-RPC result");
  assert.equal(allow.response.result.structuredContent.results.length, 1);
  assert.equal(allow.response.result.structuredContent.results[0].id, "decision-runtime-canary");
  const allowDecision = findEvent(allow.audits, "tool_call_decision");
  assert.ok(allowDecision, "allow path must emit decision audit");
  assert.equal(allowDecision.payload.decision_receipt.decision_code, "allow");
  assert.ok(allowDecision.payload.decision_receipt.reason_codes.includes("explicit_policy_allow"));
  assert.ok(findEvent(allow.audits, "tool_call_start"), "allow path must emit tool_call_start after decision");
  assert.ok(findEvent(allow.audits, "tool_call_end"), "allow path must emit tool_call_end");
  assertNoRawSecret(allow, "allow path response and audit");

  const unknown = await callTool(
    {
      name: "stage12_step39_unknown_tool",
      arguments: { secret_token: RAW_SECRET },
    },
    "req-step39-unknown"
  );

  assert.equal(unknown.response.error.code, -32602);
  assert.match(unknown.response.error.message, /Unknown tool: stage12_step39_unknown_tool/);
  const unknownDecision = findEvent(unknown.audits, "tool_call_decision");
  assert.ok(unknownDecision, "unknown path must emit decision audit");
  assert.equal(unknownDecision.payload.decision_receipt.decision_code, "unknown_tool");
  assert.ok(unknownDecision.payload.decision_receipt.reason_codes.includes("unknown_tool"));
  const unknownError = findEvent(unknown.audits, "tool_call_error");
  assert.ok(unknownError, "unknown path must emit tool_call_error");
  assert.equal(unknownError.payload.error_kind, "unknown_tool");
  assertNoRawSecret(unknown, "unknown path response and audit");

  const malformed = await callTool(
    {
      arguments: { secret_token: RAW_SECRET },
    },
    "req-step39-malformed"
  );

  assert.equal(malformed.response.error.code, -32602);
  assert.equal(malformed.response.error.message, "Invalid tool call decision context");
  const malformedDecision = findEvent(malformed.audits, "tool_call_decision");
  assert.ok(malformedDecision, "malformed path must emit decision audit");
  assert.equal(malformedDecision.payload.decision_receipt.decision_code, "missing_tool_name");
  assert.ok(malformedDecision.payload.decision_receipt.reason_codes.includes("missing_tool_name"));
  const malformedError = findEvent(malformed.audits, "tool_call_error");
  assert.ok(malformedError, "malformed path must emit tool_call_error");
  assert.equal(malformedError.payload.error_kind, "missing_tool_name");
  assertNoRawSecret(malformed, "malformed path response and audit");

  console.log("smoke_decision_runtime_p1_coverage ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
