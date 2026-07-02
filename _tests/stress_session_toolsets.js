const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";
const ROUNDS = Number(process.env.MCP_TEST_STAGE8_STRESS_ROUNDS || 80);
const CONCURRENCY = Number(process.env.MCP_TEST_STAGE8_STRESS_CONCURRENCY || 8);

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
    if (mode === 0) tasks.push(() => callTool("session_toolset_status"));
    if (mode === 1) tasks.push(() => callTool("session_toolset_plan", { profile: "public", include_plugin_candidates: false, detail_level: "summary" }));
    if (mode === 2) tasks.push(() => callTool("session_toolset_plan", { profile: "public", include_plugin_candidates: true, detail_level: "summary" }));
    if (mode === 3) tasks.push(() => callTool("session_toolset_plan", { profile: "internal", include_plugin_candidates: true, detail_level: "summary" }));
  }

  const results = await runPool(tasks, CONCURRENCY);
  for (const result of results) {
    const p = result.payload;
    assert.equal(p.success, true, `${result.name} success`);
    assert.equal(p.mode, "session-toolset-preview-only", `${result.name} mode`);
    assert.equal(p.dynamic_import_enabled, false, `${result.name} import flag`);
    assert.equal(p.plugin_execution_enabled, false, `${result.name} plugin execution flag`);
    assert.equal(p.list_changed_enabled, false, `${result.name} list_changed flag`);
    if (result.name === "session_toolset_status") {
      assert.equal(p.current_global_tool_surface_count, 40);
      assert.equal(p.gateway.gateway_server_enabled, false);
      assert.equal(p.gateway.session_store_enabled, false);
      assert.equal(p.per_session_tools_list_enabled, false);
    } else {
      assert.equal(p.real_session_mutation_enabled, false);
      assert.equal(p.gateway_server_enabled, false);
      assert.equal(p.per_session_tools_list_enabled, false);
      if (p.include_plugin_candidates) {
        assert.equal(p.candidate_plugin_tool_count, 1);
        assert.equal(p.would_require_gateway, true);
        assert.equal(p.would_require_list_changed, true);
      }
    }
  }

  const latencies = results.map((item) => item.latency_ms);
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
