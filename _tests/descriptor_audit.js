const assert = require("node:assert/strict");
const audit = require("../src/descriptor_audit");
const { EXPECTED_TOOL_NAMES, PUBLIC_TOOL_NAMES, auditToolDescriptors } = audit;

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";
const EXPECTED_PROFILE = process.env.MCP_TEST_EXPECTED_PROFILE || "public";

async function rpc(method, params = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  assert.equal(response.status, 200, `${method} HTTP status`);
  return response.json();
}

(async () => {
  const listed = await rpc("tools/list", {});
  const tools = listed.result?.tools || [];
  const expectedToolNames = EXPECTED_PROFILE === "tests-full" ? EXPECTED_TOOL_NAMES : PUBLIC_TOOL_NAMES;
  const auditResult = auditToolDescriptors(tools, { expectedToolNames });

  assert.equal(auditResult.ok, true, auditResult.errors.join("; "));
  assert.equal(auditResult.count, expectedToolNames.length);

  console.log(JSON.stringify({ ok: true, expected_profile: EXPECTED_PROFILE, count: auditResult.count, tools: auditResult.tool_names }, null, 2));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
