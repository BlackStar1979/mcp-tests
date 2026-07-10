const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");

const ROOT = path.resolve(__dirname, "..");

const optionalTools = [];
const support = createRuntimeSupportAssembly({
  auditLogPath: path.join(ROOT, "_logs", ".smoke-runtime-support-tools-cache.jsonl"),
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

const first = support.toolsList();
const second = support.toolsList();
assert.deepEqual(second, first);
assert.notStrictEqual(second, first);
assert.equal(first.length, 2);

optionalTools.push({
  name: "optional_example",
  descriptor: {
    name: "optional_example",
    title: "Optional Example",
    description: "Example optional descriptor for cache invalidation smoke.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
});

const third = support.toolsList();
assert.equal(third.length, 3);
assert.ok(third.some((tool) => tool.name === "optional_example"));

console.log("smoke_runtime_support_tools_cache ok");
