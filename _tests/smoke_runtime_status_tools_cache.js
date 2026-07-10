const assert = require("node:assert/strict");
const { createRuntimeStatusAssembly } = require("../src/runtime/runtime_status_assembly");

let toolsListCalls = 0;
const toolStore = [
  {
    name: "search",
    title: "Search",
    description: "Search",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "fetch",
    title: "Fetch",
    description: "Fetch",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

function toolsList() {
  toolsListCalls += 1;
  return toolStore.slice();
}

const provider = createRuntimeStatusAssembly({
  serverName: "test",
  serverVersion: "0.0.0",
  connectorShapeVersion: "shape",
  outputMode: "structured",
  publicBaseUrl: "http://127.0.0.1:3009",
  host: "127.0.0.1",
  port: 3009,
  authPolicy: { mode: "none", requiresAuth: false },
  auditVersion: "audit-v1",
  auditLogPath: ".audit.jsonl",
  maxFetchTextChars: 1200,
  stageStatus: "stage",
  runtimeProfile: "public",
  toolsList,
  serverStartId: "start-1",
  disableLegacyInitialize: false,
});

const first = provider();
assert.equal(first.enabled_tools.length, 2);
assert.equal(toolsListCalls, 1);

const second = provider();
assert.equal(second.enabled_tools.length, 2);
assert.equal(toolsListCalls, 2);

toolStore[1] = {
  ...toolStore[1],
  title: "Fetch Updated",
};

const third = provider();
assert.equal(third.enabled_tools.length, 2);
assert.equal(toolsListCalls, 3);
assert.notEqual(third.tool_surface.combined_fingerprint, second.tool_surface.combined_fingerprint);

console.log("smoke_runtime_status_tools_cache ok");
