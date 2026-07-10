"use strict";

const assert = require("node:assert/strict");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");

async function dispatch(method) {
  const audits = [];
  const response = await dispatchRpcMessage({
    prelude: { id: 1, method, params: {} },
    context: { requestId: `req-${method}`, sessionId: "" },
    serverName: "mcp-tests-response-shape",
    serverVersion: "0.40.0",
    connectorShapeVersion: "2025-05-strict-v1",
    outputMode: "structured",
    authMode: "oauth21",
    profile: "internal",
    tools: [],
    auditLog: (event, data) => audits.push({ event, data }),
    serverStartId: "start-a",
    disableLegacyInitialize: false,
  });
  return { response, audits };
}

(async () => {
  const resources = await dispatch("resources/list");
  assert.deepEqual(resources.response.result, { resources: [] });
  assert.ok(resources.audits.some((entry) => entry.event === "resources_list_served" && entry.data.resource_count === 0));

  const templates = await dispatch("resources/templates/list");
  assert.deepEqual(templates.response.result, { resourceTemplates: [] });
  assert.ok(templates.audits.some((entry) => entry.event === "resource_templates_list_served" && entry.data.resource_template_count === 0));

  const prompts = await dispatch("prompts/list");
  assert.deepEqual(prompts.response.result, { prompts: [] });
  assert.ok(prompts.audits.some((entry) => entry.event === "prompts_list_served" && entry.data.prompt_count === 0));

  console.log("smoke_discovery_compat_empty_lists ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
