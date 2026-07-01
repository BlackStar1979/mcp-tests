const assert = require("node:assert/strict");
const { auditToolSchemas, assertToolSchemas } = require("../src/schema_compat");

const validTools = [
  {
    name: "valid_tool",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query." },
        limit: { type: "number" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: { success: { type: "boolean" } },
      required: ["success"],
      additionalProperties: false,
    },
  },
  {
    name: "empty_args_tool",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
];

const ok = auditToolSchemas(validTools);
assert.equal(ok.success, true);
assert.equal(ok.error_count, 0);
assert.equal(ok.tool_count, 2);
assert.equal(typeof ok.schema_fingerprint, "string");
assert.doesNotThrow(() => assertToolSchemas(validTools));

const invalidTools = [
  {
    name: "string_schema_tool",
    inputSchema: { type: "string" },
    outputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "bad_required_tool",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["missing", "query", "query"],
    },
    outputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "bad_props_tool",
    inputSchema: {
      type: "object",
      properties: [],
    },
    outputSchema: { type: "object", additionalProperties: true },
  },
];

const bad = auditToolSchemas(invalidTools);
assert.equal(bad.success, false);
assert.ok(bad.error_count >= 4);
assert.ok(bad.issues.some((issue) => issue.tool === "string_schema_tool" && issue.path === "inputSchema.type"));
assert.ok(bad.issues.some((issue) => issue.tool === "bad_required_tool" && issue.message.includes("missing")));
assert.ok(bad.issues.some((issue) => issue.tool === "bad_required_tool" && issue.message.includes("unique")));
assert.ok(bad.issues.some((issue) => issue.tool === "bad_props_tool" && issue.path === "inputSchema.properties"));
assert.ok(bad.issues.some((issue) => issue.tool === "bad_props_tool" && issue.path === "outputSchema.properties"));
assert.ok(bad.issues.some((issue) => issue.tool === "bad_props_tool" && issue.path === "outputSchema.additionalProperties"));
assert.throws(() => assertToolSchemas(invalidTools), /schema compatibility audit failed/);

console.log("smoke_schema_compat ok");
