"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { decide } = require("../src/runtime/policy_enforcement_gate");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

const toolsSpec = {
  tool_catalog: {
    ok_tool: { resource_class: "public_index", operation_class: "read", surface_class: "public_mcp_tools" },
    bad_tool: { resource_class: "public_index", operation_class: "write", surface_class: "public_mcp_tools" },
  },
};
const resourceSpec = {
  resource_classes: { public_index: { allowed_operations: ["read"] } },
  operation_classes: { read: { mutation: false }, write: { mutation: true } },
};

const ok = decide({ toolName: "ok_tool", toolsSpec, resourceSpec });
assert.equal(ok.allow, true);

const bad = decide({ toolName: "bad_tool", toolsSpec, resourceSpec });
assert.ok(!bad.allow);
assert.equal(bad.error.code, -32602);
assert.ok(bad.data.reason_codes.includes("operation_not_allowed_for_resource_class"));
const handler = read("src", "runtime", "tools_call_handler.js");
assert.ok(handler.includes("decideRuntimePolicyGate"));
assert.ok(handler.includes("tool_call_policy_denied"));
assert.ok(handler.indexOf("decideRuntimePolicyGate") < handler.indexOf("tool_call_start"));
assert.equal(json("SERVER_POLICY_RUNTIME_SPEC.json").runtime_enforced, true);
assert.equal(json("SERVER_RESOURCE_POLICY_SPEC.json").runtime_enforced, true);
console.log("smoke_stage14_5_runtime_policy_gate_apply ok");
