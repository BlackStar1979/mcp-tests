"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, "_workflow", "state.json");
const CANON_PATH = path.join(ROOT, "_workflow", "WORKFLOW_CANON.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function runNode(args, id) {
  const started = new Date().toISOString();
  const child = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
  });
  return {
    id,
    kind: "local_validation",
    source: "local_process",
    route: "workflow_validate.spawnSync",
    command: `node ${args.join(" ")}`,
    executed_at: started,
    result: child.status === 0 ? "ok" : "failed",
    status: child.status,
    stdout: (child.stdout || "").trim().slice(0, 4000),
    stderr: (child.stderr || "").trim().slice(0, 4000),
  };
}

function validateStateShape(state) {
  const required = [
    "schema_version",
    "project",
    "updated_at",
    "source_of_operational_truth",
    "current_work_package",
    "last_validated_runtime",
    "active_controls",
    "workflow_layout",
  ];
  for (const key of required) {
    if (!(key in state)) throw new Error(`state missing ${key}`);
  }
  if (state.schema_version !== "workflow-state-compact-v1") throw new Error("unsupported compact workflow state schema");
  if (state.project !== "mcp-tests") throw new Error("workflow state project mismatch");
  if (state.source_of_operational_truth !== "_workflow/WORKFLOW_CANON.md") throw new Error("state must point to WORKFLOW_CANON.md");
  if (!Array.isArray(state.active_controls)) throw new Error("active_controls must be array");
}

function validateCanon(canon) {
  for (const token of [
    "# TEST MCP WORKFLOW CANON",
    "Truth layers",
    "Current validated state",
    "Runtime architecture",
    "Active controls",
    "Workflow/deploy vocabulary",
    "Directory roles and retention",
  ]) {
    if (!canon.includes(token)) throw new Error(`canon missing ${token}`);
  }
}

function validate({ profile = "sanity" } = {}) {
  const failures = [];
  try {
    validateStateShape(readJson(STATE_PATH));
  } catch (error) {
    failures.push(error.message);
  }
  try {
    validateCanon(readText(CANON_PATH));
  } catch (error) {
    failures.push(error.message);
  }

  const evidence = [];
  if (profile === "targeted" || profile === "closeout") {
    evidence.push(runNode(["_tests/smoke_workplace_contract.js"], "workflow_canon_guard"));
    if (evidence[evidence.length - 1].result !== "ok") failures.push("workflow canon guard failed");
  }
  if (profile === "closeout") {
    evidence.push(runNode(["_tests/run_all_smokes.js", "--skip-network"], "full_smoke_skip_network"));
    if (evidence[evidence.length - 1].result !== "ok") failures.push("full smoke --skip-network failed");
  }

  return { ok: failures.length === 0, profile, failures, evidence };
}

function parseArgs(argv) {
  const args = { profile: "sanity" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") {
      args.profile = argv[++i];
    } else if (arg === "--update-state") {
      // Compact state is not mutated by this validator.
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!["sanity", "targeted", "closeout"].includes(args.profile)) {
    throw new Error(`unsupported profile: ${args.profile}`);
  }
  return args;
}

if (require.main === module) {
  try {
    const result = validate(parseArgs(process.argv));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = { validate };
