const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const stageDir = path.join(root, "_workflow", "control_plane", "selftest");
const deployRoot = path.join(root, "_workflow", "control_plane", "deploy_records");
const deployFileBackupRoot = path.join(root, "_workflow", "control_plane", "file_backups");
const deploymentId = "stage8_52d_control_plane_selftest";

function run(args) {
  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return result;
}

function readJson(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

fs.mkdirSync(stageDir, { recursive: true });
fs.rmSync(path.join(stageDir, "target.txt"), { force: true });

const source = path.join(stageDir, "source.txt");
const manifest = path.join(stageDir, "manifest.json");
fs.writeFileSync(source, "stage8_52d source\n", "utf8");
fs.writeFileSync(manifest, JSON.stringify({
  deployment_name: "stage8_52d_control_plane_selftest",
  files: [
    {
      source: "_workflow/control_plane/selftest/source.txt",
      target: "_workflow/control_plane/selftest/target.txt",
    },
  ],
}, null, 2), "utf8");

for (const suffix of ["prepare", "executed", "rollback", "rollback-dry-run"]) {
  fs.rmSync(path.join(deployRoot, `${deploymentId}.${suffix}.json`), { force: true });
}
fs.rmSync(path.join(deployFileBackupRoot, deploymentId), { recursive: true, force: true });

const manifestRel = "_workflow/control_plane/selftest/manifest.json";

run(["-File", "_workflow/scripts/test_mcp_deploy.ps1", "-Mode", "Prepare", "-Manifest", manifestRel, "-DeploymentId", deploymentId, "-SkipChecks"]);
const prepareRecord = readJson(path.join(deployRoot, `${deploymentId}.prepare.json`));
assert.equal(prepareRecord.status, "prepared");
assert.equal(prepareRecord.files.length, 1);
assert.equal(prepareRecord.files[0].target_exists, false);
assert.equal(prepareRecord.files[0].target_bytes, null);

run(["-File", "_workflow/scripts/test_mcp_deploy.ps1", "-Mode", "Execute", "-Manifest", manifestRel, "-DeploymentId", deploymentId, "-SkipChecks"]);
const executedRecord = readJson(path.join(deployRoot, `${deploymentId}.executed.json`));
assert.equal(executedRecord.status, "executed");
assert.equal(executedRecord.files.length, 1);
assert.equal(executedRecord.files[0].target_sha256_before, null);
assert.ok(executedRecord.files[0].target_sha256_after);
assert.equal(fs.readFileSync(path.join(stageDir, "target.txt"), "utf8"), "stage8_52d source\n");
assert.ok(fs.existsSync(path.join(deployFileBackupRoot, deploymentId)), "deploy file backup directory must exist");

run(["-File", "_workflow/scripts/test_mcp_rollback.ps1", "-DeploymentId", deploymentId, "-WhatIfOnly", "-SkipChecks"]);
const dryRollback = readJson(path.join(deployRoot, `${deploymentId}.rollback-dry-run.json`));
assert.equal(dryRollback.status, "rollback_dry_run");
assert.equal(dryRollback.files[0].action, "delete_new_file");
assert.equal(dryRollback.files[0].applied, false);
assert.ok(fs.existsSync(path.join(stageDir, "target.txt")), "dry-run rollback must not remove target");

run(["-File", "_workflow/scripts/test_mcp_rollback.ps1", "-DeploymentId", deploymentId, "-SkipChecks"]);
const rollback = readJson(path.join(deployRoot, `${deploymentId}.rollback.json`));
assert.equal(rollback.status, "rolled_back");
assert.equal(rollback.files[0].action, "delete_new_file");
assert.equal(rollback.files[0].applied, true);
assert.equal(fs.existsSync(path.join(stageDir, "target.txt")), false, "real rollback must remove new target");

console.log("smoke_control_plane_deploy_rollback ok");
