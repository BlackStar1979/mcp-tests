const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";
const ROUNDS = Number(process.env.MCP_TEST_STAGE7_STRESS_ROUNDS || 80);
const CONCURRENCY = Number(process.env.MCP_TEST_STAGE7_STRESS_CONCURRENCY || 8);

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
    if (mode === 0) tasks.push(() => callTool("plugin_registry_status"));
    if (mode === 1) tasks.push(() => callTool("plugin_registry_list"));
    if (mode === 2) tasks.push(() => callTool("plugin_registry_get", { plugin_id: "sample.echo_readonly" }));
    if (mode === 3) tasks.push(() => callTool("plugin_registry_audit"));
  }

  const results = await runPool(tasks, CONCURRENCY);
  for (const result of results) {
    const p = result.payload;
    assert.equal(p.success, true, `${result.name} success`);
    if (result.name === "plugin_registry_status") {
      assert.equal(p.mode, "preview-only");
      assert.equal(p.dynamic_import_enabled, false);
      assert.equal(p.list_changed_enabled, false);
      assert.equal(p.executable_tool_count, 0);
      assert.equal(p.valid_count, 1);
      assert.equal(p.invalid_count, 0);
    }
    if (result.name === "plugin_registry_list") {
      assert.equal(p.candidate_tool_count, 1);
      assert.equal(p.candidate_tools[0].tool_name, "plugin_sample_echo_preview");
    }
    if (result.name === "plugin_registry_get") {
      assert.equal(p.plugin.plugin_id, "sample.echo_readonly");
      assert.equal(p.plugin.validation.ok, true);
    }
    if (result.name === "plugin_registry_audit") {
      assert.equal(p.ok, true);
      assert.equal(p.risk_counts["readonly-local"], 1);
    }
  }

  const missing = await callTool("plugin_registry_get", { plugin_id: "missing.plugin" });
  assert.equal(missing.payload.success, false);

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
