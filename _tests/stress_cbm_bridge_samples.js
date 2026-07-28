"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createCbmTools } = require("../src/integrations/codebase_memory/cbm_tools");

const REPO_ROOT = path.resolve(__dirname, "..");
const SAMPLE_ROOT = path.join(REPO_ROOT, "_repos_with_code_samples");
const DEFAULT_REPOS = [
  "cloudflared-master",
  "codebase-memory-mcp-main",
  "typescript-sdk-main",
  "python-sdk-main",
];

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function argFlag(name) {
  return process.argv.includes(`--${name}`);
}

const REPOS = (argValue("repos", process.env.MCP_TEST_CBM_STRESS_REPOS || DEFAULT_REPOS.join(",")) || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const ROUNDS = Math.max(1, Number(argValue("rounds", process.env.MCP_TEST_CBM_STRESS_ROUNDS || "12")));
const MODE = argValue("mode", process.env.MCP_TEST_CBM_STRESS_MODE || "moderate");
const LIFECYCLE_ROUNDS = Math.max(0, Number(argValue("lifecycle-rounds", process.env.MCP_TEST_CBM_STRESS_LIFECYCLE_ROUNDS || String(ROUNDS))));
const LIFECYCLE_MODE = argValue("lifecycle-mode", process.env.MCP_TEST_CBM_STRESS_LIFECYCLE_MODE || "fast");
const KEEP_INDEXES = argFlag("keep-indexes") || process.env.MCP_TEST_CBM_STRESS_KEEP_INDEXES === "1";
const RUN_ID = argValue("run-id", `${process.pid}-${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, "-");
const REPORT_DIR = path.join(REPO_ROOT, "_logs");

const tools = new Map(createCbmTools().map((tool) => [tool.name, tool]));

function tool(name) {
  const found = tools.get(name);
  assert.ok(found, `missing tool ${name}`);
  return found;
}

function comparable(value) {
  return String(value || "").replaceAll("\\", "/").toLowerCase();
}

function projectFor(repoName) {
  return `mcp-tests-cbm-stress-${repoName}-${RUN_ID}`;
}

function relativeToWork(absolutePath) {
  return path.relative("C:\\Work", absolutePath).replaceAll("\\", "/");
}

function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(duration_ms|queue_wait_ms|execution_ms|diagnostic|elapsed_ms|indexed_at|created_at|updated_at)$/i.test(key)) continue;
    if (/^(head_sha|base_sha)$/i.test(key)) continue;
    output[key] = stripVolatile(child);
  }
  return output;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function envelopeSignature(envelope) {
  return stable(stripVolatile({
    success: envelope?.success,
    error_code: envelope?.error_code,
    partial_success: envelope?.partial_success,
    timed_out: envelope?.timed_out,
    stdout_truncated: envelope?.stdout_truncated,
    stderr_truncated: envelope?.stderr_truncated,
    result: envelope?.result,
    warnings: envelope?.warnings,
  }));
}

function latencyStats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] || 0;
  return {
    count: sorted.length,
    min_ms: sorted[0] || 0,
    p50_ms: pick(0.5),
    p90_ms: pick(0.9),
    p95_ms: pick(0.95),
    max_ms: sorted[sorted.length - 1] || 0,
  };
}

async function call(name, args = {}, context = {}) {
  const started = Date.now();
  const envelope = await tool(name).execute(args);
  const latencyMs = Date.now() - started;
  return {
    name,
    args,
    context,
    latency_ms: latencyMs,
    envelope,
    signature: envelopeSignature(envelope),
  };
}

function assertHealthyEnvelope(record, allow = {}) {
  const envelope = record.envelope;
  if (record.name === "cbm_status") {
    assert.equal(envelope.available, true, "cbm_status unavailable");
    assert.equal(envelope.version, "0.9.0");
    return;
  }
  if (allow.nativeRejected && envelope?.error_code === "cbm_native_rejected") return;
  assert.equal(envelope?.success, true, `${record.name}: ${envelope?.error || envelope?.error_code}`);
  assert.notEqual(envelope.error_code, "cbm_timeout", record.name);
  assert.notEqual(envelope.error_code, "cbm_output_limit", record.name);
  assert.notEqual(envelope.error_code, "cbm_invalid_output", record.name);
  assert.equal(envelope.timed_out, false, record.name);
  assert.equal(envelope.stdout_truncated, false, record.name);
  assert.equal(envelope.stderr_truncated, false, record.name);
}

function firstQualifiedSymbol(searchEnvelope) {
  const results = Array.isArray(searchEnvelope?.result?.results) ? searchEnvelope.result.results : [];
  return results.find((item) => item.qualified_name && ["Function", "Method", "Class"].includes(item.label))
    || results.find((item) => item.qualified_name)
    || null;
}

async function findQualifiedSymbol(summary, repoName, project, initialEnvelope) {
  const initial = firstQualifiedSymbol(initialEnvelope);
  if (initial?.qualified_name) return initial;

  const fallbackSearches = [
    { label: "Function", name_pattern: ".*", limit: 50 },
    { label: "Method", name_pattern: ".*", limit: 50 },
    { label: "Class", name_pattern: ".*", limit: 50 },
    { qn_pattern: ".*", limit: 50 },
  ];
  for (const search of fallbackSearches) {
    const record = await call("cbm_search_graph", { project_name: project, ...search }, {
      repo: repoName,
      round: "symbol-fallback",
    });
    assertHealthyEnvelope(record);
    recordCall(summary, record, repoName, "symbol-fallback");
    const symbol = firstQualifiedSymbol(record.envelope);
    if (symbol?.qualified_name) return symbol;
  }

  return null;
}

function recordCall(summary, record, repoName, round) {
  summary.calls.push({
    repo: repoName,
    tool: record.name,
    round,
    latency_ms: record.latency_ms,
    success: record.envelope?.success,
    error_code: record.envelope?.error_code || "",
    partial_success: Boolean(record.envelope?.partial_success),
    warning_count: Array.isArray(record.envelope?.warnings) ? record.envelope.warnings.length : 0,
  });
}

function recordRepeatedToolStats(summary, repoName, project, name, records, options = {}) {
  const signatures = new Set(records.map((record) => record.signature));
  summary.tool_stats.push({
    repo: repoName,
    project,
    tool: name,
    rounds: records.length,
    distinct_signatures: signatures.size,
    latency: latencyStats(records.map((record) => record.latency_ms)),
    partial_success_count: records.filter((record) => record.envelope?.partial_success).length,
    warning_count: records.reduce((sum, record) => sum + (Array.isArray(record.envelope?.warnings) ? record.envelope.warnings.length : 0), 0),
  });
  if (!options.allowUnstable && signatures.size !== 1) {
    summary.instability.push({ repo: repoName, project, tool: name, distinct_signatures: signatures.size });
  }
}

function toolCallCounts(summary) {
  const counts = {};
  for (const record of summary.calls) counts[record.tool] = (counts[record.tool] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

async function repeatGlobal(summary, name, argsFactory, options = {}) {
  const records = [];
  for (let index = 0; index < ROUNDS; index += 1) {
    const record = await call(name, argsFactory(index), { repo: "__global__", round: index });
    assertHealthyEnvelope(record, options.allow || {});
    records.push(record);
    recordCall(summary, record, "__global__", index);
  }
  recordRepeatedToolStats(summary, "__global__", "__global__", name, records, options);
  return records;
}

async function repeat(summary, repoName, project, name, argsFactory, options = {}) {
  const records = [];
  for (let index = 0; index < ROUNDS; index += 1) {
    const record = await call(name, argsFactory(index), { repo: repoName, round: index });
    assertHealthyEnvelope(record, options.allow || {});
    records.push(record);
    recordCall(summary, record, repoName, index);
  }
  recordRepeatedToolStats(summary, repoName, project, name, records, options);
  return records;
}

async function stressRepoLifecycle(summary, repoName, logicalPath) {
  const indexRecords = [];
  const deleteRecords = [];
  for (let index = 0; index < LIFECYCLE_ROUNDS; index += 1) {
    const project = `${projectFor(repoName)}-life-${index}`;
    const indexed = await call("cbm_index_repository", {
      path: logicalPath,
      name: project,
      mode: LIFECYCLE_MODE,
      persistence: false,
    }, { repo: repoName, round: `lifecycle-${index}` });
    assertHealthyEnvelope(indexed);
    indexRecords.push(indexed);
    recordCall(summary, indexed, repoName, `lifecycle-${index}`);
    summary.lifecycle_indexes.push({
      repo: repoName,
      project,
      mode: LIFECYCLE_MODE,
      latency_ms: indexed.latency_ms,
      nodes: indexed.envelope.result?.nodes || 0,
      edges: indexed.envelope.result?.edges || 0,
      skipped_count: indexed.envelope.result?.skipped_count || 0,
      partial_success: Boolean(indexed.envelope.partial_success),
      warnings: indexed.envelope.warnings || [],
    });

    const deleted = await call("cbm_delete_project", { project }, { repo: repoName, round: `lifecycle-${index}` });
    assertHealthyEnvelope(deleted);
    deleteRecords.push(deleted);
    recordCall(summary, deleted, repoName, `lifecycle-${index}`);
    summary.lifecycle_deleted_projects.push(project);
  }
  if (indexRecords.length > 0) recordRepeatedToolStats(summary, repoName, projectFor(repoName), "cbm_index_repository", indexRecords, { allowUnstable: true });
  if (deleteRecords.length > 0) recordRepeatedToolStats(summary, repoName, projectFor(repoName), "cbm_delete_project", deleteRecords, { allowUnstable: true });
}

async function stressRepo(summary, repoName) {
  const absolute = path.join(SAMPLE_ROOT, repoName);
  assert.equal(fs.existsSync(absolute), true, `missing sample repo ${repoName}`);
  const project = projectFor(repoName);
  const logicalPath = relativeToWork(absolute);

  if (LIFECYCLE_ROUNDS > 0) await stressRepoLifecycle(summary, repoName, logicalPath);

  const indexed = await call("cbm_index_repository", {
    path: logicalPath,
    name: project,
    mode: MODE,
    persistence: false,
  }, { repo: repoName });
  assertHealthyEnvelope(indexed);
  recordCall(summary, indexed, repoName, "primary-index");
  summary.indexes.push({
    repo: repoName,
    project,
    mode: MODE,
    latency_ms: indexed.latency_ms,
    nodes: indexed.envelope.result?.nodes || 0,
    edges: indexed.envelope.result?.edges || 0,
    skipped_count: indexed.envelope.result?.skipped_count || 0,
    partial_success: Boolean(indexed.envelope.partial_success),
    warnings: indexed.envelope.warnings || [],
  });

  const graphRecords = await repeat(summary, repoName, project, "cbm_search_graph", () => ({
    project_name: project,
    query: "server",
    limit: 25,
  }));
  const symbol = await findQualifiedSymbol(summary, repoName, project, graphRecords[0].envelope);

  await repeat(summary, repoName, project, "cbm_index_status", () => ({ project_name: project }));
  await repeat(summary, repoName, project, "cbm_get_graph_schema", () => ({ project_name: project }));
  await repeat(summary, repoName, project, "cbm_get_architecture", () => ({ project_name: project, aspects: ["overview"] }));
  await repeat(summary, repoName, project, "cbm_search_code", () => ({
    project_name: project,
    pattern: "server",
    mode: "compact",
    limit: 25,
  }));
  await repeat(summary, repoName, project, "cbm_query_graph", () => ({
    project_name: project,
    query: "MATCH (n) RETURN n LIMIT 10",
    max_rows: 10,
  }));
  if (symbol?.qualified_name) {
    await repeat(summary, repoName, project, "cbm_get_code_snippet", () => ({
      project_name: project,
      qualified_name: symbol.qualified_name,
      include_neighbors: true,
    }));
    await repeat(summary, repoName, project, "cbm_trace_path", () => ({
      project_name: project,
      function_name: symbol.qualified_name,
      direction: "both",
      depth: 2,
      include_tests: false,
    }), { allowUnstable: true });
  } else {
    summary.sample_limitations.push({
      repo: repoName,
      project,
      limitation: "no_qualified_symbol_for_snippet_or_trace",
    });
  }

  const adrContent = `# CBM stress ADR\n\nProject: ${project}\nRun: ${RUN_ID}\n`;
  const adrUpdate = await call("cbm_manage_adr", { project_name: project, mode: "update", content: adrContent }, { repo: repoName });
  assertHealthyEnvelope(adrUpdate);
  recordCall(summary, adrUpdate, repoName, "adr-update");
  await repeat(summary, repoName, project, "cbm_manage_adr", () => ({ project_name: project, mode: "get" }));

  await repeat(summary, repoName, project, "cbm_ingest_traces", () => ({
    project_name: project,
    traces: [{
      trace_id: `trace-${repoName}`,
      span_id: "span-1",
      name: "stress.span",
      start_time_unix_nano: "1",
      end_time_unix_nano: "2",
      attributes: { repo: repoName, run_id: RUN_ID },
    }],
  }));

  const detectRecords = await repeat(summary, repoName, project, "cbm_detect_changes", () => ({
    project_name: project,
    depth: 2,
  }), { allow: { nativeRejected: true }, allowUnstable: true });
  const detectNativeRejected = detectRecords.every((record) => record.envelope?.error_code === "cbm_native_rejected");
  summary.notes.push({
    repo: repoName,
    project,
    note: detectNativeRejected
      ? "detect_changes returned native rejection on non-git sample repo; git success coverage remains in C-Work-mcp-tests baseline."
      : "detect_changes returned successful envelopes for this sample.",
  });

  if (!KEEP_INDEXES) {
    const deleted = await call("cbm_delete_project", { project }, { repo: repoName });
    assertHealthyEnvelope(deleted);
    recordCall(summary, deleted, repoName, "primary-delete");
    summary.deleted_projects.push(project);
  }
}

(async () => {
  const status = await call("cbm_status", {});
  assertHealthyEnvelope(status);
  const listedBefore = await call("cbm_list_projects", {});
  assertHealthyEnvelope(listedBefore);

  const summary = {
    ok: false,
    run_id: RUN_ID,
    repos: REPOS,
    rounds_per_tool_per_repo: ROUNDS,
    mode: MODE,
    lifecycle_rounds_per_repo: LIFECYCLE_ROUNDS,
    lifecycle_mode: LIFECYCLE_MODE,
    keep_indexes: KEEP_INDEXES,
    status: {
      version: status.envelope.version,
      compatibility_status: status.envelope.compatibility_status,
      native_tool_count: status.envelope.native_tool_count,
      allowed_root: status.envelope.allowed_root,
      heavy_read_capacity: status.envelope.heavy_read_capacity,
    },
    indexes: [],
    lifecycle_indexes: [],
    tool_stats: [],
    calls: [],
    instability: [],
    sample_limitations: [],
    notes: [],
    deleted_projects: [],
    lifecycle_deleted_projects: [],
  };
  recordCall(summary, status, "__global__", "initial");
  recordCall(summary, listedBefore, "__global__", "initial");

  try {
    await repeatGlobal(summary, "cbm_status", () => ({}));
    await repeatGlobal(summary, "cbm_list_projects", () => ({}));
    for (const repoName of REPOS) {
      await stressRepo(summary, repoName);
    }
  } finally {
    if (!KEEP_INDEXES) {
      for (const repoName of REPOS) {
        const project = projectFor(repoName);
        if (summary.deleted_projects.includes(project)) continue;
        try {
          await tool("cbm_delete_project").execute({ project });
        } catch {
          // Best-effort cleanup for unique stress indexes only.
        }
      }
    }
  }

  const finalStatus = await call("cbm_status", {});
  assertHealthyEnvelope(finalStatus);
  recordCall(summary, finalStatus, "__global__", "final");
  assert.equal(finalStatus.envelope.mutation_busy, false);
  assert.equal(finalStatus.envelope.heavy_read_active, 0);
  assert.equal(finalStatus.envelope.heavy_read_queued, 0);

  summary.ok = summary.instability.length === 0;
  summary.total_calls = summary.calls.length;
  summary.tool_call_counts = toolCallCounts(summary);
  summary.overall_latency = latencyStats(summary.calls.map((callRecord) => callRecord.latency_ms));

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `cbm-bridge-stress-${RUN_ID}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: summary.ok,
    report: reportPath,
    repos: summary.repos,
    rounds_per_tool_per_repo: summary.rounds_per_tool_per_repo,
    lifecycle_rounds_per_repo: summary.lifecycle_rounds_per_repo,
    indexes: summary.indexes.map((item) => ({
      repo: item.repo,
      nodes: item.nodes,
      edges: item.edges,
      skipped_count: item.skipped_count,
      latency_ms: item.latency_ms,
      partial_success: item.partial_success,
    })),
    lifecycle_indexes: summary.lifecycle_indexes.length,
    total_calls: summary.total_calls,
    tool_call_counts: summary.tool_call_counts,
    instability: summary.instability,
    overall_latency: summary.overall_latency,
  }, null, 2));

  if (!summary.ok) process.exit(1);
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
