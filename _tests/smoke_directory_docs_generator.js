"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "generate_directory_docs.js");
const SNAPSHOT_ROOT = path.join(ROOT, "_workflow", "control_plane", "snapshots");
const FILE_BACKUPS_ROOT = path.join(ROOT, "_workflow", "control_plane", "file_backups");
const PRUNE_BACKUPS_ROOT = path.join(ROOT, "_workflow", "control_plane", "oauth21_prune_backups");
const SMOKE_SNAPSHOT_ROOT = path.join(SNAPSHOT_ROOT, "smoke-directory-docs-generator");
const TRACKED_PRUNE_BUNDLE_ROOT = path.join(PRUNE_BACKUPS_ROOT, "live-prune-2026-07-15");
const TRACKED_PRUNE_FIXTURES = [
  "oauth21-prune-14996-1784134322605.apply-receipt.json",
  "oauth21-prune-14996-1784134322605.oauth_storage.backup.sqlite",
  "oauth21-prune-14996-1784134322605.rollback-receipt.json",
];

fs.mkdirSync(SMOKE_SNAPSHOT_ROOT, { recursive: true });
fs.writeFileSync(path.join(SMOKE_SNAPSHOT_ROOT, "fixture.txt"), "fixture\n", "utf8");
for (const fixture of TRACKED_PRUNE_FIXTURES) {
  fs.writeFileSync(path.join(TRACKED_PRUNE_BUNDLE_ROOT, fixture), "", "utf8");
}
process.on("exit", () => {
  fs.rmSync(SMOKE_SNAPSHOT_ROOT, { recursive: true, force: true });
  for (const fixture of TRACKED_PRUNE_FIXTURES) {
    fs.rmSync(path.join(TRACKED_PRUNE_BUNDLE_ROOT, fixture), { force: true });
  }
});

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function runGenerator() {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

const result = runGenerator();
assert.equal(result.status, 0, `directory docs generator must succeed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
const normalizedStdout = result.stdout.replace(/\\/g, "/");
assert.match(normalizedStdout, /wrote DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote \.agents\/skills\/using-codebase-memory\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote \.agents\/skills\/using-codebase-memory\/references\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote _workflow\/control_plane\/snapshots\//);
assert.match(normalizedStdout, /wrote _workflow\/control_plane\/file_backups\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote _workflow\/control_plane\/oauth21_prune_backups\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote _workflow\/operator_decisions\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote src\/integrations\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote src\/integrations\/codebase_memory\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote docs\/superpowers\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote docs\/superpowers\/plans\/DIRECTORY\.md/);
assert.match(normalizedStdout, /wrote docs\/superpowers\/specs\/DIRECTORY\.md/);

const packageJson = read("package.json");
const scriptSource = read(path.join("scripts", "generate_directory_docs.js"));
const rootDirectory = read("DIRECTORY.md");
const scriptsDirectory = read("scripts/DIRECTORY.md");
const cbmSkillDirectory = read(".agents/skills/using-codebase-memory/DIRECTORY.md");
const cbmSkillReferencesDirectory = read(".agents/skills/using-codebase-memory/references/DIRECTORY.md");
const workflowDirectory = read("_workflow/DIRECTORY.md");
const operatorDecisionsDirectory = read("_workflow/operator_decisions/DIRECTORY.md");
const fileBackupsDirectory = read("_workflow/control_plane/file_backups/DIRECTORY.md");
const pruneBackupsDirectory = read("_workflow/control_plane/oauth21_prune_backups/DIRECTORY.md");
const testsDirectory = read("_tests/DIRECTORY.md");
const srcDirectory = read("src/DIRECTORY.md");
const integrationsDirectory = read("src/integrations/DIRECTORY.md");
const codebaseMemoryDirectory = read("src/integrations/codebase_memory/DIRECTORY.md");
const docsDirectory = read("docs/DIRECTORY.md");
const superpowersDirectory = read("docs/superpowers/DIRECTORY.md");
const superpowersPlansDirectory = read("docs/superpowers/plans/DIRECTORY.md");
const superpowersSpecsDirectory = read("docs/superpowers/specs/DIRECTORY.md");
const todayMatch = scriptSource.match(/const TODAY = "([^"]+)";/);
assert.ok(todayMatch, "generator must declare TODAY constant");
const today = todayMatch[1];
const operatorDecisionsUpdatedMatch = scriptSource.match(
  /"_workflow\/operator_decisions":\s*\{[\s\S]*?updated:\s*"([^"]+)"/
);
assert.ok(operatorDecisionsUpdatedMatch, "generator must configure operator decisions update date");
const operatorDecisionsUpdated = operatorDecisionsUpdatedMatch[1];
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));
assert.ok(packageJson.includes("\"docs:directory:audit\": \"node scripts/audit_directory_docs.js\""));
assert.ok(rootDirectory.includes(`Updated: ${today}`));
assert.ok(scriptsDirectory.includes("`audit_directory_docs.js`"));
assert.ok(scriptsDirectory.includes("Audits high-churn tracked directories"));
assert.ok(cbmSkillDirectory.includes("Status: active using-codebase-memory skill directory map"));
assert.ok(cbmSkillDirectory.includes("repository, index, runtime, and client/UI truth boundaries"));
assert.ok(cbmSkillReferencesDirectory.includes("Status: active using-codebase-memory references directory map"));
assert.ok(cbmSkillReferencesDirectory.includes("Per-tool argument, mutation, and caveat reference"));
assert.ok(workflowDirectory.includes("bounded OAuth21 prune records/backups"));
assert.ok(operatorDecisionsDirectory.includes(`Updated: ${operatorDecisionsUpdated}`));
assert.ok(operatorDecisionsDirectory.includes("initialize_client_compatibility_evidence.md"));
assert.ok(operatorDecisionsDirectory.includes("retr_1_quality_regression_closeout.md"));
assert.ok(operatorDecisionsDirectory.includes("process_job_persistence_live_acceptance.md"));
assert.ok(operatorDecisionsDirectory.includes("run_process_sync_ceiling.md"));
assert.ok(operatorDecisionsDirectory.includes("Connector refresh, migration, callable-surface"));
assert.ok(operatorDecisionsDirectory.includes("This directory is a decision ledger, not the active queue."));
assert.ok(fileBackupsDirectory.includes("runtime-owned backup bundles"));
assert.ok(fileBackupsDirectory.includes("It is currently empty."));
assert.ok(pruneBackupsDirectory.includes("explicit OAuth21 prune execute runs"));
assert.ok(pruneBackupsDirectory.includes("live-prune-2026-07-15/"));
assert.ok(srcDirectory.includes("Updated: 2026-07-27"));
assert.ok(testsDirectory.includes("`smoke_directory_docs_audit.js`"));
assert.ok(testsDirectory.includes("`smoke_build_index_tool.js`"));
assert.ok(docsDirectory.includes("Status: active documentation directory map"));
assert.ok(docsDirectory.includes("Imported or adapted Superpowers planning/specification material"));
assert.ok(docsDirectory.includes("PROCESS_RUNNER_CONSUMER_INSTRUCTION.md"));
assert.ok(superpowersDirectory.includes("Status: active superpowers documentation directory map"));
assert.ok(superpowersDirectory.includes("supporting workflow material"));
assert.ok(superpowersPlansDirectory.includes("Status: active superpowers plans directory map"));
assert.ok(superpowersPlansDirectory.includes("2026-07-26-cbm-full-tool-surface.md"));
assert.ok(superpowersPlansDirectory.includes("2026-08-09-process-runner-async.md"));
assert.ok(superpowersPlansDirectory.includes("2026-08-13-structured-file-mutation.md"));
assert.ok(superpowersSpecsDirectory.includes("Status: active superpowers specs directory map"));
assert.ok(superpowersSpecsDirectory.includes("2026-07-26-cbm-full-tool-surface-design.md"));
assert.ok(superpowersSpecsDirectory.includes("2026-08-09-process-runner-async-design.md"));
assert.ok(superpowersSpecsDirectory.includes("2026-08-13-structured-file-mutation-design.md"));
assert.ok(srcDirectory.includes("`integrations/`"));
assert.ok(integrationsDirectory.includes("Updated: 2026-07-27"));
assert.ok(codebaseMemoryDirectory.includes("Updated: 2026-07-27"));
assert.ok(integrationsDirectory.includes("`codebase_memory/`"));
assert.ok(integrationsDirectory.includes("External integration boundaries"));
assert.ok(codebaseMemoryDirectory.includes("`cbm_cli_bridge.js`"));
assert.ok(codebaseMemoryDirectory.includes("`cbm_tools.js`"));
assert.ok(codebaseMemoryDirectory.includes("`cbm_contract_registry.js`"));
assert.ok(codebaseMemoryDirectory.includes("`contracts/`"));
assert.ok(codebaseMemoryDirectory.includes("index truth"));

const snapshotDirs = fs
  .readdirSync(SNAPSHOT_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

assert.ok(snapshotDirs.length > 0, "expected archived control-plane snapshots to exist");

for (const snapshotName of snapshotDirs) {
  const rel = path.join("_workflow", "control_plane", "snapshots", snapshotName, "DIRECTORY.md");
  const content = read(rel);
  assert.ok(content.includes("Status: archived snapshot directory map"), `${snapshotName} must be marked as archived snapshot`);
  assert.ok(content.includes(snapshotName), `${snapshotName} must be named in its generated DIRECTORY.md`);
  assert.ok(content.includes("archival evidence only"), `${snapshotName} must keep archival authority boundary`);
}

const runtimeOwnedRoots = [
  {
    root: FILE_BACKUPS_ROOT,
    relRoot: path.join("_workflow", "control_plane", "file_backups"),
    emptyOk: true,
  },
  {
    root: PRUNE_BACKUPS_ROOT,
    relRoot: path.join("_workflow", "control_plane", "oauth21_prune_backups"),
    emptyOk: false,
  },
];

for (const runtimeRoot of runtimeOwnedRoots) {
  const childDirs = fs
    .readdirSync(runtimeRoot.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (!runtimeRoot.emptyOk) {
    assert.ok(childDirs.length > 0, `${runtimeRoot.relRoot} must keep at least one bundle directory for generator coverage`);
  }

  for (const childName of childDirs) {
    const rel = path.join(runtimeRoot.relRoot, childName, "DIRECTORY.md");
    const content = read(rel);
    assert.ok(content.includes(`This bundle belongs to \`${childName}\``), `${childName} must be named in its generated DIRECTORY.md`);
    assert.ok(content.includes("runtime-owned support material"), `${childName} must keep runtime-owned support boundary`);
    if (!runtimeRoot.emptyOk && childName === "live-prune-2026-07-15") {
      assert.ok(content.includes("SQLite backup artifact"), `${childName} must describe sqlite backup artifacts`);
      assert.ok(content.includes("JSON control-plane receipt"), `${childName} must describe json receipt artifacts`);
    }
  }
}

console.log("smoke_directory_docs_generator ok");
