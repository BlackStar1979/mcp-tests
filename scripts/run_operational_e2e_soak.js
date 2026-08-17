"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { CliArgumentError, parseCliArgs } = require("../src/util/cli_args");

const root = path.resolve(__dirname, "..");
const matrixPath = path.join(root, "_workflow", "inventories", "ops_1a_operational_e2e_matrix.json");
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));

function parseArgsOrExit() {
  try {
    return parseCliArgs(process.argv.slice(2), {
      valueOptions: ["repetitions", "live-repetitions"],
      flagOptions: ["include-live-cloudflare", "include-live-network", "list"],
    });
  } catch (error) {
    if (error instanceof CliArgumentError) {
      console.error(JSON.stringify({ ok: false, error_code: error.code, argument: error.argument }, null, 2));
      process.exit(2);
    }
    throw error;
  }
}

function readNumberArg(args, name, fallback) {
  const value = Number(args.value(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error(`--${name} must be an integer between 1 and 20`);
  }
  return value;
}

const args = parseArgsOrExit();
const repetitions = readNumberArg(args, "repetitions", 3);
const liveRepetitions = readNumberArg(args, "live-repetitions", 1);
const includeLiveCloudflare = args.flag("include-live-cloudflare");
const includeLiveNetwork = args.flag("include-live-network");
const listOnly = args.flag("list");

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
