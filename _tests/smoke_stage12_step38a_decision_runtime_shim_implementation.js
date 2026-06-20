"use strict";

const assert = require("node:assert/strict");
const { buildDecisionRuntimeContext } = require("../src/runtime/decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");
const { buildDecisionRuntimeReceipt } = require("../src/runtime/decision_runtime_receipt");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");

const audits = [];
function auditLog(type, payload) { audits.push({ type, payload }); }

const optionalTool = {
  descriptor: {
    name: "demo_optional",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["x"],
      properties: { x: { type: "integer" } },
    },
  },
  execute: async () => ({ ok: true, value: 7 }),
  summarizeArgs: () => ({ arg_summary_status: "ok", arg_key_count: 1 }),
  resultStats: () => ({ result_count: 1, result_chars: 20 }),
};
function getOptionalTool(name) { return name === "demo_optional" ? optionalTool : null; }

const ctx = buildDecisionRuntimeContext({
  toolName: "search",
  args: { query: "REDACT_ME_VALUE" },
  authMode: "bearer",
  profile: "internal",
  getOptionalTool,
  requestMeta: { requestId: "req-1" },
});
assert.equal(ctx.ok, true);
assert.equal(JSON.stringify(ctx).includes("REDACT_ME_VALUE"), false);
assert.equal(ctx.context.known_tool, true);

const allowDecision = evaluateDecisionRuntimePolicy({ decisionContext: ctx });
assert.equal(allowDecision.allow, true);
const receipt = buildDecisionRuntimeReceipt({ decision: allowDecision, context: ctx.context, timing: { startedAt: Date.now() - 1, endedAt: Date.now() }, route: "unit" });
assert.equal(receipt.version, "decision-runtime-receipt-v1");
assert.equal(receipt.decision_code, "allow");
assert.equal(JSON.stringify(receipt).includes("REDACT_ME_VALUE"), false);

const malformed = buildDecisionRuntimeContext({ toolName: "", authMode: "bearer", profile: "internal" });
assert.equal(malformed.ok, false);
assert.ok(malformed.reason_codes.includes("missing_tool_name"));
assert.equal(evaluateDecisionRuntimePolicy({ decisionContext: malformed }).allow, false);

(async () => {
  const optionalResponse = await handleToolsCall({ id: 1, params: { name: "search", arguments: { query: "demo" } }, context: { requestId: "req-2" }, outputMode: "structured", authMode: "bearer", profile: "internal", getOptionalTool, auditLog, documentRuntimeContext: () => ({ docs: [{ id: "a", title: "Demo", text: "demo", url: "doc://a" }] }) });
  assert.ok(Array.isArray(optionalResponse.result.structuredContent.results));
  assert.ok(audits.some((entry) => entry.type === "tool_call_decision"));
  const unknownResponse = await handleToolsCall({ id: 2, params: { name: "missing_tool", arguments: {} }, context: { requestId: "req-3" }, outputMode: "structured", authMode: "bearer", profile: "internal", getOptionalTool, auditLog });
  assert.equal(unknownResponse.error.code, -32602);
  assert.equal(unknownResponse.error.message, "Unknown tool: missing_tool");
  console.log("smoke_stage12_step38a_decision_runtime_shim_implementation ok");
})().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });
