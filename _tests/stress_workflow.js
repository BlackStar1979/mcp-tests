"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { renderDocs, renderStateSection } = require("../_workflow/scripts/render_workflow_docs");
const { patchSection, sha256 } = require("../_workflow/scripts/patch_section_by_markers");
const { createSnapshot } = require("../_workflow/scripts/workflow_snapshot");

const ROOT = path.resolve(__dirname, "..");
const WORKFLOW_ROOT = path.join(ROOT, "_workflow");
const STATE_PATH = path.join(WORKFLOW_ROOT, "state.json");
const ARTIFACT_ROOT = path.join(ROOT, "_backups", "workflow_stress");

function nowIso() {
  return new Date().toISOString();
}

function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function msSince(startNs) {
  return Number(process.hrtime.bigint() - startNs) / 1_000_000;
}

function runCase(name, fn) {
  const started = nowIso();
  const startNs = process.hrtime.bigint();
  try {
    const details = fn() || {};
    return {
      name,
      ok: true,
      started_at: started,
      duration_ms: Math.round(msSince(startNs) * 1000) / 1000,
      details,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      started_at: started,
      duration_ms: Math.round(msSince(startNs) * 1000) / 1000,
      error: error?.stack || error?.message || String(error),
    };
  }
}

function findDuplicateCaseNames(cases) {
  const seen = new Set();
  const duplicates = new Set();

  for (const item of cases) {
    if (seen.has(item.name)) {
      duplicates.add(item.name);
    }
    seen.add(item.name);
  }

  return [...duplicates].sort();
}

function assertNoClosedStageDocsInWorkflowRoot() {
  const forbidden = fs.readdirSync(WORKFLOW_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^(STAGE|STEP).*\.md$/i.test(name));
  assert.deepEqual(forbidden, []);
  return forbidden.length;
}

function makeArtifactDir() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  return fs.mkdtempSync(path.join(ARTIFACT_ROOT, "run-"));
}

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function expectFailure(label, fn) {
  try {
    fn();
  } catch (error) {
    return { label, ok: true, message: error.message };
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

function relativeFromRoot(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function runNodeScript(scriptPath) {
  const child = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  return {
    status: child.status,
    stdout: (child.stdout || "").trim(),
    stderr: (child.stderr || "").trim(),
  };
}

function countLiteral(text, literal) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(literal, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + literal.length;
  }
}

function main() {
  process.chdir(ROOT);
  const artifactDir = makeArtifactDir();
  const stateText = fs.readFileSync(STATE_PATH, "utf8");
  const state = JSON.parse(stateText);

  const cases = [];

  cases.push(runCase("state_parse_and_invariant_stress", () => {
    const iterations = 1000;
    for (let i = 0; i < iterations; i += 1) {
      const parsed = JSON.parse(stateText);
      assert.equal(parsed.schema_version, "workflow-state-v1");
      assert.equal(parsed.project, "mcp-tests");
      assert.equal(parsed.current_work_package.restart_pending, false);
      assert.equal(parsed.current_work_package.connector_visible_change, false);
      assert.equal(parsed.current_work_package.operator_controlled_restart_required, false);
      assert.ok(parsed.current_work_package.canonical_plan.startsWith("_workflow/"));
      assert.ok(fs.existsSync(path.join(ROOT, parsed.current_work_package.canonical_plan)));
      assert.equal(parsed.raw_audit_export_allowed, false);
    }
    return { iterations, state_bytes: Buffer.byteLength(stateText, "utf8") };
  }));

  cases.push(runCase("workflow_root_layout_guard_stress", () => {
    const iterations = 200;
    for (let i = 0; i < iterations; i += 1) {
      assertNoClosedStageDocsInWorkflowRoot();
    }
    const rootEntries = fs.readdirSync(WORKFLOW_ROOT).sort();
    assert.ok(rootEntries.includes("longterm"));
    assert.ok(rootEntries.includes("scripts"));
    assert.ok(rootEntries.includes("state.json"));
    return { iterations, root_entry_count: rootEntries.length, root_entries: rootEntries };
  }));

  cases.push(runCase("topology_cleanup_guard_child_process", () => {
    const result = runNodeScript("_tests/smoke_stage8_51_topology_cleanup_guard.js");
    assert.ok(result.stdout.includes("smoke_stage8_51_topology_cleanup_guard ok"));
    return result;
  }));

  cases.push(runCase("run_all_smokes_workflow_smoke_dedup_guard", () => {
    const text = fs.readFileSync(path.join(ROOT, "_tests", "run_all_smokes.js"), "utf8");
    const literal = "runNode(\"_tests/smoke_workflow_state.js\", env)";
    const count = countLiteral(text, literal);
    assert.equal(count, 1, "run_all_smokes.js must invoke smoke_workflow_state exactly once");
    return { literal_count: count };
  }));

  cases.push(runCase("audit_export_redaction_safeguard_child_process", () => {
    const scripts = [
      "_tests/smoke_stage8_24_audit_export_safety.js",
      "_tests/smoke_stage8_41_audit_export_redaction_hardening.js",
      "_tests/smoke_stage8_45_observability_redaction_summary.js",
    ];
    const results = scripts.map((script) => ({ script, ...runNodeScript(script) }));
    assert.ok(results.every((result) => result.stdout.includes(" ok")));
    return { scripts: results.map((result) => result.script) };
  }));

  cases.push(runCase("io_safety_policy_expansion_trigger_guard", () => {
    const result = runNodeScript("_tests/smoke_stage8_54_io_safety_policy.js");
    assert.ok(result.stdout.includes("smoke_stage8_54_io_safety_policy ok"));
    return result;
  }));

  cases.push(runCase("io_safety_active_controls_guard", () => {
    const result = runNodeScript("_tests/smoke_stage8_55_io_safety_active_controls.js");
    assert.ok(result.stdout.includes("smoke_stage8_55_io_safety_active_controls ok"));
    return result;
  }));

  cases.push(runCase("mcp_apps_risk_policy_guard", () => {
    const result = runNodeScript("_tests/smoke_stage8_56_mcp_apps_risk_policy.js");
    assert.ok(result.stdout.includes("smoke_stage8_56_mcp_apps_risk_policy ok"));
    return result;
  }));

  cases.push(runCase("renderer_determinism_stress", () => {
    const iterations = 100;
    const handoffHashes = new Set();
    const courseHashes = new Set();
    for (let i = 0; i < iterations; i += 1) {
      const currentState = readState();
      handoffHashes.add(sha256(renderStateSection(currentState, "handoff")));
      courseHashes.add(sha256(renderStateSection(currentState, "course")));
      const dry = renderDocs({ dryRun: true });
      assert.equal(dry.ok, true);
      assert.equal(dry.results.length, 2);
      assert.ok(dry.results.every((item) => item.ok && item.dry_run));
    }
    assert.equal(handoffHashes.size, 1);
    assert.equal(courseHashes.size, 1);
    return { iterations, handoff_hash: [...handoffHashes][0], course_hash: [...courseHashes][0] };
  }));

  cases.push(runCase("patcher_marker_edge_stress", () => {
    const iterations = 200;
    const okFile = path.join(artifactDir, "patch-ok.md");
    writeFile(okFile, "alpha\n<!-- START -->\nold\n<!-- END -->\nomega\n");
    const relOk = relativeFromRoot(okFile);
    for (let i = 0; i < iterations; i += 1) {
      const result = patchSection({
        filePath: relOk,
        startMarker: "<!-- START -->",
        endMarker: "<!-- END -->",
        replacement: `new-${i}`,
        dryRun: true,
      });
      assert.equal(result.ok, true);
      assert.equal(result.dry_run, true);
      assert.equal(fs.readFileSync(okFile, "utf8").includes("old"), true, "dry-run must not mutate file");
    }

    const mismatch = expectFailure("hash_mismatch", () => patchSection({
      filePath: relOk,
      startMarker: "<!-- START -->",
      endMarker: "<!-- END -->",
      replacement: "new",
      expectedHash: "0000",
      dryRun: true,
    }));

    const dupFile = path.join(artifactDir, "patch-duplicate.md");
    writeFile(dupFile, "<!-- START -->\na\n<!-- END -->\n<!-- START -->\nb\n<!-- END -->\n");
    const duplicate = expectFailure("duplicate_markers", () => patchSection({
      filePath: relativeFromRoot(dupFile),
      startMarker: "<!-- START -->",
      endMarker: "<!-- END -->",
      replacement: "x",
      dryRun: true,
    }));

    const missingFile = path.join(artifactDir, "patch-missing.md");
    writeFile(missingFile, "no markers\n");
    const missing = expectFailure("missing_markers", () => patchSection({
      filePath: relativeFromRoot(missingFile),
      startMarker: "<!-- START -->",
      endMarker: "<!-- END -->",
      replacement: "x",
      dryRun: true,
    }));

    const reversedFile = path.join(artifactDir, "patch-reversed.md");
    writeFile(reversedFile, "<!-- END -->\nwrong\n<!-- START -->\n");
    const reversed = expectFailure("reversed_markers", () => patchSection({
      filePath: relativeFromRoot(reversedFile),
      startMarker: "<!-- START -->",
      endMarker: "<!-- END -->",
      replacement: "x",
      dryRun: true,
    }));

    return { iterations, expected_failures: [mismatch, duplicate, missing, reversed] };
  }));

  cases.push(runCase("snapshot_minimal_stress", () => {
    const manifest = createSnapshot({
      label: "workflow-stress-minimal",
      files: ["_workflow/state.json", "_workflow/README.md", "_workflow/longterm/README.md"],
    });
    assert.equal(manifest.snapshot_version, "workflow-snapshot-v1");
    assert.equal(manifest.entries.length, 3);
    assert.ok(manifest.entries.every((entry) => entry.copied === true));
    assert.ok(manifest.entries.every((entry) => typeof entry.sha256 === "string" && entry.sha256.length === 64));
    return { snapshot_path: manifest.path, entry_count: manifest.entries.length };
  }));

  cases.push(runCase("route_policy_and_evidence_stress", () => {
    const iterations = 500;
    for (let i = 0; i < iterations; i += 1) {
      const parsed = readState();
      assert.equal(parsed.clean_execution_route.platform_block_handling.record_as_evidence, true);
      assert.equal(parsed.clean_execution_route.platform_block_handling.switch_route_after_block, true);
      assert.ok(parsed.tool_route_policy.avoid_when_possible.some((entry) => entry.includes("node -e")));
      assert.ok(parsed.tool_route_policy.avoid_when_possible.some((entry) => entry.includes("deploy_decision_guard")));
      assert.ok(parsed.validation_evidence.every((item) => typeof item.platform_blocked === "boolean"));
      assert.ok(parsed.validation_evidence.every((item) => !/\bnode\s+-e\b/.test(String(item.command || ""))));
    }
    return { iterations, evidence_count: state.validation_evidence.length };
  }));

  cases.push(runCase("workflow_smoke_child_process", () => {
    const result = runNodeScript("_tests/smoke_workflow_state.js");
    assert.ok(result.stdout.includes("smoke_workflow_state ok"));
    return result;
  }));

  const duplicateCaseNames = findDuplicateCaseNames(cases);
  const ok = cases.every((item) => item.ok) && duplicateCaseNames.length === 0;
  const result = {
    stress_version: "workflow-stress-v2",
    started_at: nowIso(),
    ok,
    artifact_dir: relativeFromRoot(artifactDir),
    case_count: cases.length,
    duplicate_case_names: duplicateCaseNames,
    cases,
  };

  const resultPath = path.join(artifactDir, "result.json");
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
