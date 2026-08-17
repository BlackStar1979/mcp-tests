"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PATCH_SCRIPT = path.join(ROOT, "_workflow", "scripts", "patch_section_by_markers.js");
const COMPACT_SCRIPT = path.join(ROOT, "_workflow", "scripts", "compact_runtime_logs.js");
const PRUNE_SCRIPT = path.join(ROOT, "_workflow", "scripts", "test_mcp_oauth21_prune.js");

function run(script, args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function parseCliError(result) {
  assert.equal(result.status, 2, result.stderr || result.stdout);
  return JSON.parse(result.stderr);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "control-plane-cli-integrity-"));
try {
  const patchTarget = path.join(tempRoot, "target.md");
  const originalTarget = "before\n<!-- start -->\nold\n<!-- end -->\nafter\n";
  fs.writeFileSync(patchTarget, originalTarget, "utf8");

  const rejectedPatch = run(PATCH_SCRIPT, [
    "--path", patchTarget,
    "--start", "<!-- start -->",
    "--end", "<!-- end -->",
    "--replacement", "new",
    "--surprise",
  ]);
  assert.equal(parseCliError(rejectedPatch).error_code, "cli_argument_unknown");
  assert.equal(fs.readFileSync(patchTarget, "utf8"), originalTarget);

  const missingPatchValue = run(PATCH_SCRIPT, [
    "--path", patchTarget,
    "--start", "<!-- start -->",
    "--end", "<!-- end -->",
    "--replacement",
  ]);
  assert.equal(parseCliError(missingPatchValue).error_code, "cli_argument_value_missing");
  assert.equal(fs.readFileSync(patchTarget, "utf8"), originalTarget);

  const patchDryRun = run(PATCH_SCRIPT, [
    `--path=${patchTarget}`,
    "--start=<!-- start -->",
    "--end=<!-- end -->",
    "--replacement=new",
    "--dryRun",
  ]);
  assert.equal(patchDryRun.status, 0, patchDryRun.stderr);
  assert.equal(JSON.parse(patchDryRun.stdout).dry_run, true);
  assert.equal(fs.readFileSync(patchTarget, "utf8"), originalTarget);

  const emptyPatchDryRun = run(PATCH_SCRIPT, [
    `--path=${patchTarget}`,
    "--start=<!-- start -->",
    "--end=<!-- end -->",
    "--replacement=",
    "--dryRun",
  ]);
  assert.equal(emptyPatchDryRun.status, 0, emptyPatchDryRun.stderr);
  assert.equal(JSON.parse(emptyPatchDryRun.stdout).dry_run, true);
  assert.equal(fs.readFileSync(patchTarget, "utf8"), originalTarget);

  const replacementFile = path.join(tempRoot, "replacement.txt");
  fs.writeFileSync(replacementFile, "from file", "utf8");
  const filePatchDryRun = run(PATCH_SCRIPT, [
    "--path", patchTarget,
    "--start", "<!-- start -->",
    "--end", "<!-- end -->",
    "--replacementFile", replacementFile,
    "--dryRun",
  ]);
  assert.equal(filePatchDryRun.status, 0, filePatchDryRun.stderr);
  assert.equal(JSON.parse(filePatchDryRun.stdout).delta_bytes, 6);
  assert.equal(fs.readFileSync(patchTarget, "utf8"), originalTarget);

  const conflictingPatch = run(PATCH_SCRIPT, [
    "--path", patchTarget,
    "--start", "<!-- start -->",
    "--end", "<!-- end -->",
    "--replacement", "inline",
    "--replacementFile", replacementFile,
  ]);
  assert.equal(parseCliError(conflictingPatch).error_code, "cli_argument_conflict");
  assert.equal(fs.readFileSync(patchTarget, "utf8"), originalTarget);

  const rawLog = path.join(tempRoot, "runtime.jsonl");
  const compactOut = path.join(tempRoot, "compact");
  const originalLog = '{"event":"one"}\n{"event":"two"}\n';
  fs.writeFileSync(rawLog, originalLog, "utf8");

  const rejectedCompact = run(COMPACT_SCRIPT, [
    "--log", rawLog,
    "--out-dir", compactOut,
    "--replace",
    "--surprise",
  ]);
  assert.equal(parseCliError(rejectedCompact).error_code, "cli_argument_unknown");
  assert.equal(fs.readFileSync(rawLog, "utf8"), originalLog);
  assert.equal(fs.existsSync(compactOut), false);

  const missingCompactValue = run(COMPACT_SCRIPT, ["--log", "--replace"]);
  assert.equal(parseCliError(missingCompactValue).error_code, "cli_argument_value_missing");
  assert.equal(fs.readFileSync(rawLog, "utf8"), originalLog);

  const compactRun = run(COMPACT_SCRIPT, [
    `--log=${rawLog}`,
    `--out-dir=${compactOut}`,
    "--tail=1",
  ]);
  assert.equal(compactRun.status, 0, compactRun.stderr);
  assert.equal(JSON.parse(compactRun.stdout).tail_lines, 1);
  assert.equal(fs.readFileSync(rawLog, "utf8"), originalLog);

  const pruneAudit = path.join(tempRoot, "prune-audit.jsonl");
  const rejectedPrune = run(PRUNE_SCRIPT, ["--mode", "Status", "--surprise"], {
    MCP_TEST_AUDIT_LOG: pruneAudit,
  });
  const pruneError = parseCliError(rejectedPrune);
  assert.equal(pruneError.error_code, "cli_argument_unknown");
  assert.equal(pruneError.argument, "surprise");

  const duplicatePrune = run(PRUNE_SCRIPT, ["--mode", "Status", "--mode", "Execute"], {
    MCP_TEST_AUDIT_LOG: pruneAudit,
  });
  assert.equal(parseCliError(duplicatePrune).error_code, "cli_argument_duplicate");

  const invalidPruneMode = run(PRUNE_SCRIPT, ["--mode", "Surprise"], {
    MCP_TEST_AUDIT_LOG: pruneAudit,
  });
  assert.equal(parseCliError(invalidPruneMode).error_code, "cli_argument_value_invalid");

  const invalidPruneTime = run(PRUNE_SCRIPT, ["--mode", "Plan", "--now-ms", "not-a-number"], {
    MCP_TEST_AUDIT_LOG: pruneAudit,
  });
  assert.equal(parseCliError(invalidPruneTime).error_code, "cli_argument_value_invalid");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("smoke_control_plane_cli_integrity ok");
