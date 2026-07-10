const assert = require("node:assert/strict");
const path = require("node:path");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");

const support = createRuntimeSupportAssembly({
  auditLogPath: path.join(__dirname, "..", "_logs", ".smoke-rpc-message-dispatcher-lazy-tools.jsonl"),
  auditVersion: "test-audit",
  serverName: "test",
  serverVersion: "0.0.0",
  connectorShapeVersion: "shape",
  docs: [],
  publicBaseUrl: "http://127.0.0.1:3009",
  maxFetchTextChars: 1200,
  outputMode: "structured",
  optionalTools: [],
  rootDir: path.join(__dirname, ".."),
});

function baseArgs() {
  return {
    context: { requestId: "req-1", sessionId: "sess-1" },
    serverName: "test",
    serverVersion: "0.0.0",
    connectorShapeVersion: "shape",
    outputMode: "structured",
    authMode: "none",
    profile: "public",
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog() {},
    getOptionalTool() { return null; },
    rateLimiter: null,
    serverStartId: "start-1",
    disableLegacyInitialize: false,
  };
}

async function countToolsCalls(prelude, extra = {}) {
  let calls = 0;
  const result = await dispatchRpcMessage({
    ...baseArgs(),
    ...extra,
    prelude,
    toolsList() {
      calls += 1;
      return support.toolsList();
    },
  });
  return { calls, result };
}

(async () => {
  const ping = await countToolsCalls({ id: 1, method: "ping", params: {} });
  assert.equal(ping.calls, 0);
  assert.deepEqual(ping.result.result, {});

  const resources = await countToolsCalls({ id: 2, method: "resources/list", params: {} });
  assert.equal(resources.calls, 0);

  const prompts = await countToolsCalls({ id: 3, method: "prompts/list", params: {} });
  assert.equal(prompts.calls, 0);

  const toolsList = await countToolsCalls({ id: 4, method: "tools/list", params: {} });
  assert.equal(toolsList.calls, 1);

  const initialize = await countToolsCalls({ id: 5, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  assert.equal(initialize.calls, 1);

  const discover = await countToolsCalls(
    { id: 6, method: "server/discover", params: {} },
    {
      context: {
        requestId: "req-2",
        sessionId: "sess-2",
        requestMetadata: {
          ok: true,
          protocolVersion: "2025-06-18",
          requestMetadataVersion: "test",
        },
      },
    }
  );
  assert.equal(discover.calls, 1);

  const legacyTools = await dispatchRpcMessage({
    ...baseArgs(),
    prelude: { id: 7, method: "tools/list", params: {} },
    tools: [{ name: "search", title: "Search" }],
  });
  assert.ok(Array.isArray(legacyTools.result.tools));

  console.log("smoke_rpc_message_dispatcher_lazy_tools ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
