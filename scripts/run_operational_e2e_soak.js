"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const matrixPath = path.join(root, "_workflow", "inventories", "ops_1a_operational_e2e_matrix.json");
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));

function readNumberArg(name, fallback) {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  const value = raw ? Number(raw.slice(prefix.length)) : fallback;
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error(`${name} must be an integer between 1 and 20`);
  }
  return value;
}

const repetitions = readNumberArg("--repetitions", 3);
const liveRepetitions = readNumberArg("--live-repetitions", 1);
const includeLiveCloudflare = process.argv.includes("--include-live-cloudflare");
const includeLiveNetwork = process.argv.includes("--include-live-network");
const listOnly = process.argv.includes("--list");

function isSelected(testCase) {
  if (testCase.default) return true;
  if (testCase.mode === "live_cloudflare") return includeLiveCloudflare;
  if (testCase.mode === "live_network") return includeLiveNetwork;
  return false;
}

const selected = matrix.soak_cases.filter(isSelected);
if (listOnly) {
  console.log(JSON.stringify({ selected, repetitions, live_repetitions: liveRepetitions }, null, 2));
  process.exit(0);
}

const startedAt = new Date().toISOString();
const results = [];
let failureCount = 0;

for (const testCase of selected) {
  const caseRepetitions = testCase.mode === "hermetic" ? repetitions : liveRepetitions;
  for (let iteration = 1; iteration <= caseRepetitions; iteration += 1) {
    const started = Date.now();
    const env = { ...process.env };
    if (testCase.mode === "live_network") {
      env.MCP_TEST_SMOKE_PORT = String(32000 + (process.pid % 1000));
    }
    const result = spawnSync(process.execPath, [testCase.script, ...(testCase.args || [])], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: testCase.mode === "live_network" ? 180000 : 120000,
      windowsHide: true,
    });
    const passed = result.status === 0 && !result.error;
    if (!passed) failureCount += 1;
    results.push({
      id: testCase.id,
      mode: testCase.mode,
      iteration,
      passed,
      duration_ms: Date.now() - started,
      exit_code: result.status,
      signal: result.signal,
      error: result.error?.message || null,
      stdout_tail: passed ? "" : String(result.stdout || "").slice(-2000),
      stderr_tail: passed ? "" : String(result.stderr || "").slice(-4000),
    });
  }
}

const report = {
  schema_version: "mcp-tests-ops-1a-soak-report-v1",
  matrix_schema_version: matrix.schema_version,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  repetitions,
  live_repetitions: liveRepetitions,
  selected_case_count: selected.length,
  invocation_count: results.length,
  passed_count: results.length - failureCount,
  failed_count: failureCount,
  modes: Array.from(new Set(selected.map((item) => item.mode))),
  results,
};

console.log(JSON.stringify(report, null, 2));
process.exit(failureCount === 0 ? 0 : 1);
