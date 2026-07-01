const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";
const ROUNDS = Number(process.env.MCP_TEST_STAGE8_1_STRESS_ROUNDS || 80);
const CONCURRENCY = Number(process.env.MCP_TEST_STAGE8_1_STRESS_CONCURRENCY || 8);

async function callTool(name, args = {}) {
  const started = Date.now();
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${name}-${started}-${Math.random()}`,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const latency_ms = Date.now() - started;
  assert.equal(response.status, 200, `${name} HTTP status`);
  const json = await response.json();
  assert.ok(json.result, `${name} JSON-RPC result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} content[0].text`);
  return { name, payload: JSON.parse(text), latency_ms };
}

async function runPool(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      results[current] = await tasks[current]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
  return {
    count: samples.length,
    min_ms: sorted[0] || 0,
    p50_ms: pick(0.5),
    p90_ms: pick(0.9),
    p99_ms: pick(0.99),
    max_ms: sorted[sorted.length - 1] || 0,
  };
}

(async () => {
  const tasks = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    const mode = i % 4;
    if (mode === 0) tasks.push(() => callTool("plugin_execution_preflight", { tool_name: "plugin_sample_echo_preview" }));
    if (mode === 1) tasks.push(() => callTool("plugin_execute_readonly", { tool_name: "plugin_sample_echo_preview", text: `stress-${i}` }));
    if (mode === 2) tasks.push(() => callTool("plugin_execute_readonly", { tool_name: "plugin_sample_echo_preview", text: "" }));
    if (mode === 3) tasks.push(() => callTool("plugin_execute_readonly", { tool_name: "plugin_sample_echo_preview", input: { text: "ok", extra: "blocked" } }));
  }

  const results = await runPool(tasks, CONCURRENCY);
  for (const result of results) {
    const p = result.payload;
    assert.equal(p.dynamic_import_enabled, false, `${result.name} import flag`);
    assert.equal(p.plugin_execution_allowed, false, `${result.name} general execution flag`);
    assert.equal(p.real_tools_list_mutation_enabled, false, `${result.name} tools/list flag`);
    assert.equal(p.list_changed_enabled, false, `${result.name} list_changed flag`);
    if (result.name === "plugin_execution_preflight") {
      assert.equal(p.success, true);
      assert.equal(p.execution_allowed_now, true);
      assert.equal(p.readonly_plugin_execution_wrapper_allowed, true);
      assert.equal(p.handler_type, "builtin.echo.readonly.v1");
    } else if (p.result && p.result.success === true) {
      assert.equal(p.success, true);
      assert.equal(p.result.echo.startsWith("stress-"), true);
    } else {
      assert.equal(p.success, false);
      assert.ok(p.error.includes("minLength") || p.error.includes("unexpected argument"));
    }
  }

  const missing = await callTool("plugin_execution_preflight", { tool_name: "missing_plugin_tool" });
  assert.equal(missing.payload.success, false);
  assert.equal(missing.payload.execution_allowed_now, false);
  assert.equal(missing.payload.readonly_plugin_execution_wrapper_allowed, false);

  const latencies = results.concat([missing]).map((item) => item.latency_ms);
  console.log(JSON.stringify({
    ok: true,
    rounds: ROUNDS,
    concurrency: CONCURRENCY,
    total_calls: latencies.length,
    latency: stats(latencies),
  }, null, 2));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
