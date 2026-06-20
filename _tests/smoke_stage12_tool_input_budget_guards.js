"use strict";

const assert = require("node:assert/strict");
const { DEFAULT_VALIDATION_LIMITS, validateToolInput } = require("../src/runtime/tool_input_validator");

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    s: { type: "string" },
    a: { type: "array", items: { type: "string" } },
    o: { type: "object", additionalProperties: true, properties: {} },
  },
};

assert.equal(DEFAULT_VALIDATION_LIMITS.maxDepth, 12);

const longString = validateToolInput("budget", { s: "x".repeat(DEFAULT_VALIDATION_LIMITS.maxStringLength + 1) }, schema);
assert.equal(longString.ok, false);
assert.ok(longString.errors.some((item) => item.includes("max string length")));

const longArray = validateToolInput("budget", { a: Array.from({ length: DEFAULT_VALIDATION_LIMITS.maxArrayItems + 1 }, () => "x") }, schema);
assert.equal(longArray.ok, false);
assert.ok(longArray.errors.some((item) => item.includes("max array items")));

const manyKeys = {};
for (let i = 0; i <= DEFAULT_VALIDATION_LIMITS.maxObjectKeys; i += 1) manyKeys[`k${i}`] = "v";
const manyObjectKeys = validateToolInput("budget", { o: manyKeys }, schema);
assert.equal(manyObjectKeys.ok, false);
assert.ok(manyObjectKeys.errors.some((item) => item.includes("max object keys")));

console.log("smoke_stage12_tool_input_budget_guards ok");
