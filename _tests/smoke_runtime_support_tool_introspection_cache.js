const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");

const ROOT = path.resolve(__dirname, "..");

const optionalTools = [];
const support = createRuntimeSupportAssembly({
  auditLogPath: path.join(ROOT, "_logs", ".smoke-runtime-support-tool-introspection-cache.jsonl"),
  auditVersion: "test-audit",
  serverName: "test",
  serverVersion: "0.0.0",
  connectorShapeVersion: "shape",
  docs: [],
  publicBaseUrl: "http://127.0.0.1:3009",
  maxFetchTextChars: 1200,
  outputMode: "structured",
  optionalTools,
  rootDir: ROOT,
});

const first = support.toolIntrospection();
const second = support.toolIntrospection();
assert.deepEqual(second.toolSurface, first.toolSurface);
assert.deepEqual(second.schemaCompatibility, first.schemaCompatibility);
assert.deepEqual(second.tools, first.tools);
assert.notStrictEqual(second.tools, first.tools);
assert.equal(first.tools.length, 2);

optionalTools.push({
  name: "optional_example",
  descriptor: {
    name: "optional_example",
    title: "Optional Example",
    description: "Example optional descriptor for introspection cache invalidation smoke.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
});

const third = support.toolIntrospection();
assert.equal(third.tools.length, 3);
assert.equal(third.toolSurface.tool_count, 3);
assert.equal(third.schemaCompatibility.tool_count, 3);
assert.ok(third.tools.some((tool) => tool.name === "optional_example"));

console.log("smoke_runtime_support_tool_introspection_cache ok");
