const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";
const ROUNDS = Number(process.env.MCP_TEST_STAGE6_1_STRESS_ROUNDS || 80);
const CONCURRENCY = Number(process.env.MCP_TEST_STAGE6_1_STRESS_CONCURRENCY || 8);

async function callTool(name, args) {
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
  return { payload: JSON.parse(text), latency_ms, name };
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
    const mode = i % 5;
    if (mode === 0) tasks.push(() => callTool("dev_code_symbols", { path: "util/code_workspace.js" }));
    if (mode === 1) tasks.push(() => callTool("dev_code_dependencies", { path: "tools", recursive: true, max_files: 100 }));
    if (mode === 2) tasks.push(() => callTool("dev_code_audit", { path: "tools", recursive: true, max_files: 100, top_n: 10 }));
    if (mode === 3) tasks.push(() => callTool("dev_code_impact", { path: "tools", target: "tools/dev_code_symbols.js", recursive: true, max_files: 100, max_depth: 3, direction: "dependencies" }));
    if (mode === 4) tasks.push(() => callTool("dev_code_syntax_check", { path: "tools/dev_code_symbols.js" }));
  }

  const results = await runPool(tasks, CONCURRENCY);
  for (const result of results) {
    const payload = result.payload;
    assert.equal(payload.success, true, `${result.name} success`);
    if (result.name === "dev_code_dependencies") {
      assert.equal(payload.unresolved_count, 0);
      assert.ok(payload.external_workspace_edges_count > 0);
    }
    if (result.name === "dev_code_audit") {
      assert.equal(payload.summary.unresolved, 0);
      assert.ok(payload.summary.external_workspace_edges > 0);
    }
    if (result.name === "dev_code_impact") {
      assert.equal(payload.dependencies_count, 3);
      assert.ok(payload.dependencies.every((item) => item.scope === "workspace-external"));
    }
    if (result.name === "dev_code_syntax_check") {
      assert.equal(payload.ok, true);
    }
  }

  const denied = await callTool("dev_code_dependencies", { path: "../mcp", recursive: true, max_files: 10 });
  assert.equal(denied.payload.success, false);

  const latencies = results.concat([denied]).map((item) => item.latency_ms);
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
