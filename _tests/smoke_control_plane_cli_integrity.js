"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { cleanupRunAllTemp, parseArgs: parseCleanupArgs } = require("../scripts/cleanup-run-all-temp");

const ROOT = path.resolve(__dirname, "..");
const PATCH_SCRIPT = path.join(ROOT, "_workflow", "scripts", "patch_section_by_markers.js");
const COMPACT_SCRIPT = path.join(ROOT, "_workflow", "scripts", "compact_runtime_logs.js");
const PRUNE_SCRIPT = path.join(ROOT, "_workflow", "scripts", "test_mcp_oauth21_prune.js");
const RETIRED_PUBLIC_SANDBOX_SYNC = path.join(ROOT, "_workflow", "scripts", "public_sandbox_sync.js");
const REPO_ROOT_READERS = [
  "_workflow/scripts/evaluate_server_spec_decisions.js",
  "_workflow/scripts/evaluate_server_spec_decision_negative_controls.js",
  "_workflow/scripts/index_authority_report.js",
  "_workflow/scripts/validate_decision_runtime_interface_contract.js",
  "_workflow/scripts/validate_decision_runtime_interface_contract_negative_controls.js",
  "_workflow/scripts/validate_server_spec_fixtures.js",
  "_workflow/scripts/validate_server_spec_negative_controls.js",
];
const NAMED_OPTION_SCRIPTS = [
  "scripts/audit_directory_docs.js",
  "scripts/backfill-memory-embeddings.js",
  "scripts/capture_cbm_contract.js",
  "scripts/cleanup-run-all-temp.js",
  "scripts/extract_upstream_repo_patterns.js",
  "scripts/repair_cbm_v090_edges_schema.js",
  "scripts/request-restart.js",
  "scripts/run_operational_e2e_soak.js",
  "_tests/run_all_smokes.js",
  "_workflow/scripts/client_entry_blocker_matrix.js",
  "_workflow/scripts/client_entry_path_report.js",
  "_workflow/scripts/compact_runtime_logs.js",
  "_workflow/scripts/connector_migration_dry_run_harness.js",
  "_workflow/scripts/patch_section_by_markers.js",
  "_workflow/scripts/process_runner_observability.js",
  "_workflow/scripts/sessionless_live_authenticated_probe.js",
  "_workflow/scripts/sessionless_manual_probe_stub.js",
  "_workflow/scripts/test_mcp_oauth21_prune.js",
  "_workflow/scripts/wait_for_client_entry_path.js",
  "_workflow/scripts/workflow_snapshot.js",
];

function run(script, args, env = {}, cwd = ROOT) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function parseCliError(result) {
  assert.equal(result.status, 2, result.stderr || result.stdout);
  return JSON.parse(result.stderr);
}

for (const relativePath of NAMED_OPTION_SCRIPTS) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  assert.match(source, /parseCliArgs/, `${relativePath} must use the shared named-option parser`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "control-plane-cli-integrity-"));
const repoTempRoot = fs.mkdtempSync(path.join(ROOT, "_control", "control-plane-cli-root-"));
try {
  assert.equal(
    fs.existsSync(RETIRED_PUBLIC_SANDBOX_SYNC),
    false,
    "the obsolete public-sandbox copy mutator must remain retired",
  );
  const workflowScriptsReadme = fs.readFileSync(path.join(ROOT, "_workflow", "scripts", "README.md"), "utf8");
  assert.doesNotMatch(
    workflowScriptsReadme.split("## Current interpretation")[0],
    /public_sandbox_sync\.js/,
    "workflow script groups must not advertise the retired mutator",
  );
  assert.match(
    workflowScriptsReadme,
    /`public_sandbox_sync\.js` is retired/,
    "workflow guidance must preserve the explicit retirement boundary",
  );

  for (const relativePath of REPO_ROOT_READERS) {
    const result = run(path.join(ROOT, relativePath), [], {}, tempRoot);
    assert.equal(result.status, 0, `${relativePath} must work from a foreign cwd\n${result.stderr || result.stdout}`);
  }

  assert.throws(() => parseCleanupArgs(["--apply", "--apply"]), { code: "cli_argument_duplicate" });
  assert.throws(() => parseCleanupArgs(["--min-age-minutes", "-1"]), { code: "cli_argument_value_invalid" });
  const cleanupFixture = path.join(tempRoot, "run-all-cleanup");
  const staleRun = path.join(cleanupFixture, "mcp-tests-run-all-99999999-1000");
  const activeRun = path.join(cleanupFixture, `mcp-tests-run-all-${process.pid}-1001`);
  const recentRun = path.join(cleanupFixture, "mcp-tests-run-all-99999998-1002");
  const unrelated = path.join(cleanupFixture, "unrelated-temp");
  for (const directory of [staleRun, activeRun, recentRun, unrelated]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(staleRun, "payload.bin"), "stale");
  const oldTime = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(staleRun, oldTime, oldTime);
  fs.utimesSync(activeRun, oldTime, oldTime);
  const cleanupPlan = cleanupRunAllTemp({ tempRoot: cleanupFixture, minAgeMinutes: 15 });
  assert.equal(cleanupPlan.mode, "plan");
  assert.equal(cleanupPlan.candidate_count, 1);
  assert.equal(cleanupPlan.removed_count, 0);
  assert.equal(cleanupPlan.skipped_active_count, 1);
  assert.equal(cleanupPlan.skipped_recent_count, 1);
  assert.equal(fs.existsSync(staleRun), true);
  const cleanupApply = cleanupRunAllTemp({ tempRoot: cleanupFixture, apply: true, minAgeMinutes: 15 });
  assert.equal(cleanupApply.removed_count, 1);
  assert.equal(cleanupApply.removed_bytes, 5);
  assert.equal(fs.existsSync(staleRun), false);
  assert.equal(fs.existsSync(activeRun), true);
  assert.equal(fs.existsSync(recentRun), true);
  assert.equal(fs.existsSync(unrelated), true);

  const runAllScript = path.join(ROOT, "_tests", "run_all_smokes.js");
  assert.equal(parseCliError(run(runAllScript, ["--surprise"], {}, tempRoot)).error_code, "cli_argument_unknown");
  assert.equal(parseCliError(run(runAllScript, ["--manifest"], {}, tempRoot)).error_code, "cli_argument_value_missing");
  assert.equal(
    parseCliError(run(runAllScript, ["--manifest", "first.json", "--manifest", "second.json"], {}, tempRoot)).error_code,
    "cli_argument_duplicate"
  );
  assert.equal(
    parseCliError(run(runAllScript, ["--skip-network=true"], {}, tempRoot)).error_code,
    "cli_argument_flag_value_not_allowed"
  );

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

  const repoPatchTarget = path.join(repoTempRoot, "relative-target.md");
  const repoPatchRelative = path.relative(ROOT, repoPatchTarget);
  fs.writeFileSync(repoPatchTarget, originalTarget, "utf8");
  const foreignCwdPatch = run(PATCH_SCRIPT, [
    "--path", repoPatchRelative,
    "--start", "<!-- start -->",
    "--end", "<!-- end -->",
    "--replacement", "foreign cwd",
  ], {}, tempRoot);
  assert.equal(foreignCwdPatch.status, 0, foreignCwdPatch.stderr || foreignCwdPatch.stdout);
  assert.match(fs.readFileSync(repoPatchTarget, "utf8"), /foreign cwd/);

  const repoLog = path.join(repoTempRoot, "relative-runtime.jsonl");
  const repoOut = path.join(repoTempRoot, "relative-compact");
  fs.writeFileSync(repoLog, originalLog, "utf8");
  const foreignCwdCompact = run(COMPACT_SCRIPT, [
    "--log", path.relative(ROOT, repoLog),
    "--out-dir", path.relative(ROOT, repoOut),
    "--tail", "1",
  ], {}, tempRoot);
  assert.equal(foreignCwdCompact.status, 0, foreignCwdCompact.stderr || foreignCwdCompact.stdout);
  assert.equal(JSON.parse(foreignCwdCompact.stdout).parsed, 2);
  assert.ok(fs.existsSync(path.join(repoOut, "runtime_audit_summary.json")));

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
  fs.rmSync(repoTempRoot, { recursive: true, force: true });
}

console.log("smoke_control_plane_cli_integrity ok");
