const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";
const FS_ROUNDS = Number(process.env.MCP_TEST_STRESS_FS_ROUNDS || 120);
const NET_ROUNDS = Number(process.env.MCP_TEST_STRESS_NET_ROUNDS || 12);
const CONCURRENCY = Number(process.env.MCP_TEST_STRESS_CONCURRENCY || 12);

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
  assert.ok(json.result, `${name} must return JSON-RPC result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return { payload: JSON.parse(text), latency_ms };
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
  for (let i = 0; i < FS_ROUNDS; i += 1) {
    const mode = i % 5;
    if (mode === 0) tasks.push(() => callTool("fs_list_public", { path: "." }));
    if (mode === 1) tasks.push(() => callTool("fs_get_public_info", { path: "docs/large-lines.txt" }));
    if (mode === 2) tasks.push(() => callTool("fs_read_public_text", { path: "docs/large-lines.txt", max_chars: 512 }));
    if (mode === 3) tasks.push(() => callTool("fs_read_public_lines", { path: "docs/large-lines.txt", start_line: 10, end_line: 12 }));
    if (mode === 4) tasks.push(() => callTool("fs_read_public_chunk", { path: "docs/large-lines.txt", offset: 100, length: 128 }));
  }

  const fsResults = await runPool(tasks, CONCURRENCY);
  for (const result of fsResults) {
    assert.equal(result.payload.success, true, JSON.stringify(result.payload));
  }

  const deniedTraversal = await callTool("fs_read_public_text", { path: "../server.js", max_chars: 512 });
  assert.equal(deniedTraversal.payload.success, false);
  assert.match(deniedTraversal.payload.error, /traversal/i);

  const deniedDrive = await callTool("fs_read_public_text", { path: "C:/Work/mcp-tests/server.js", max_chars: 512 });
  assert.equal(deniedDrive.payload.success, false);
  assert.match(deniedDrive.payload.error, /Drive-letter/i);

  const networkTasks = [];
  for (let i = 0; i < NET_ROUNDS; i += 1) {
    networkTasks.push(() => callTool("net_check_url_head", { url: "https://modelcontextprotocol.io/" }));
  }
  const netResults = await runPool(networkTasks, Math.min(4, CONCURRENCY));
  for (const result of netResults) {
    assert.equal(result.payload.success, true, JSON.stringify(result.payload));
    assert.equal(result.payload.status, 200);
  }

  const latencies = [...fsResults, deniedTraversal, deniedDrive, ...netResults].map((item) => item.latency_ms);
  console.log(JSON.stringify({
    ok: true,
    mcp_url: MCP_URL,
    fs_rounds: FS_ROUNDS,
    net_rounds: NET_ROUNDS,
    concurrency: CONCURRENCY,
    total_calls: latencies.length,
    latency: stats(latencies),
  }, null, 2));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
