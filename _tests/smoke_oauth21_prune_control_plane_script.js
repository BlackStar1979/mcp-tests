"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "_workflow", "scripts", "test_mcp_oauth21_prune.js");

function run(args, env = {}) {
  return cp.execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  }).trim();
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oauth21-prune-control-plane-"));
const auditLog = path.join(tempRoot, "audit.jsonl");
const oauthStatePath = path.join(tempRoot, "tests_oauth_state.json");
const clientsPath = path.join(tempRoot, "tests_oauth_clients.json");
const backupDir = path.join(tempRoot, "backups");
const approvalMarkerFile = path.join(tempRoot, "approval.json");
const recordsDir = path.join(ROOT, "_workflow", "control_plane", "oauth21_prune_records");

fs.writeFileSync(oauthStatePath, JSON.stringify({
  access: [
    { token: "access-live", clientId: "active-client", grantId: "grant-live", expiresAt: Date.parse("2026-07-12T13:00:00.000Z") },
    { token: "access-orphan", clientId: "missing-client", grantId: "grant-orphan", expiresAt: Date.parse("2026-07-12T13:00:00.000Z") },
  ],
  refresh: [],
  used_refresh: [],
}, null, 2), "utf8");
fs.writeFileSync(clientsPath, JSON.stringify([
  { client_id: "active-client", client_id_issued_at: Math.floor(Date.parse("2026-07-10T12:00:00.000Z") / 1000) },
  { client_id: "dead-old", client_id_issued_at: Math.floor(Date.parse("2026-06-20T12:00:00.000Z") / 1000) },
], null, 2), "utf8");
fs.writeFileSync(approvalMarkerFile, JSON.stringify({
  id: "operator_approved_oauth21_prune_apply",
  approved: true,
  oauth21_prune_authorized: true,
  file_mutation_authorized: true,
  approved_by: "operator",
  approved_at: "2026-07-12T12:00:00.000Z",
}, null, 2), "utf8");

const planOutput = run([
  "--mode", "Plan",
  "--oauth-state-file", oauthStatePath,
  "--oauth-clients-file", clientsPath,
  "--backup-dir", backupDir,
  "--approval-marker-file", approvalMarkerFile,
  "--operator", "operator",
  "--reason", "smoke plan",
  "--now-ms", String(Date.parse("2026-07-12T12:00:00.000Z")),
], { MCP_TEST_AUDIT_LOG: auditLog });
assert.ok(planOutput.startsWith("PLAN RECORD: "));
const planFile = planOutput.slice("PLAN RECORD: ".length);
assert.equal(fs.existsSync(planFile), true);
const planRecord = JSON.parse(fs.readFileSync(planFile, "utf8"));
assert.equal(planRecord.mode, "plan");
assert.equal(planRecord.plan.candidate_counts.total_candidates, 2);
assert.equal(planRecord.plan.execute_performed, false);
assert.equal(planRecord.draft.apply_allowed_now, false);

const execOutput = run([
  "--mode", "Execute",
  "--oauth-state-file", oauthStatePath,
  "--oauth-clients-file", clientsPath,
  "--backup-dir", backupDir,
  "--approval-marker-file", approvalMarkerFile,
  "--operator", "operator",
  "--reason", "smoke execute",
  "--now-ms", String(Date.parse("2026-07-12T12:00:00.000Z")),
], { MCP_TEST_AUDIT_LOG: auditLog });
assert.ok(execOutput.startsWith("EXECUTED RECORD: "));
const execFile = execOutput.slice("EXECUTED RECORD: ".length);
assert.equal(fs.existsSync(execFile), true);
const execRecord = JSON.parse(fs.readFileSync(execFile, "utf8"));
assert.equal(execRecord.mode, "execute");
assert.equal(execRecord.execution.success, true);
assert.equal(fs.existsSync(execRecord.execution.receipt_paths.rollback_receipt), true);
assert.equal(fs.existsSync(execRecord.execution.receipt_paths.apply_receipt), true);

const stateAfter = JSON.parse(fs.readFileSync(oauthStatePath, "utf8"));
const clientsAfter = JSON.parse(fs.readFileSync(clientsPath, "utf8"));
assert.equal(stateAfter.access.some((item) => item.token === "access-orphan"), false);
assert.equal(clientsAfter.some((item) => item.client_id === "dead-old"), false);

const rollbackOutput = run([
  "--mode", "Rollback",
  "--record-file", execFile,
], { MCP_TEST_AUDIT_LOG: auditLog });
assert.ok(rollbackOutput.startsWith("ROLLBACK RECORD: "));
const rollbackFile = rollbackOutput.slice("ROLLBACK RECORD: ".length);
assert.equal(fs.existsSync(rollbackFile), true);
const rollbackRecord = JSON.parse(fs.readFileSync(rollbackFile, "utf8"));
assert.equal(rollbackRecord.mode, "rollback");
assert.equal(rollbackRecord.status, "rolled_back");
assert.equal(rollbackRecord.files.length, 2);

const stateRolledBack = JSON.parse(fs.readFileSync(oauthStatePath, "utf8"));
const clientsRolledBack = JSON.parse(fs.readFileSync(clientsPath, "utf8"));
assert.equal(stateRolledBack.access.some((item) => item.token === "access-orphan"), true);
assert.equal(clientsRolledBack.some((item) => item.client_id === "dead-old"), true);

const statusJson = JSON.parse(run(["--mode", "Status"], { MCP_TEST_AUDIT_LOG: auditLog }));
assert.equal(statusJson.success, true);
assert.equal(statusJson.mode, "oauth21-prune-control-plane-status");
assert.equal(statusJson.record_root_exists, true);
assert.equal(statusJson.backup_root_exists, true);

const auditText = fs.readFileSync(auditLog, "utf8");
assert.ok(auditText.includes("oauth21_prune_control_plane_start"));
assert.ok(auditText.includes("oauth21_prune_plan_ok"));
assert.ok(auditText.includes("oauth21_prune_execute_ok"));
assert.ok(auditText.includes("oauth21_prune_rollback_finish"));

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("smoke_oauth21_prune_control_plane_script ok");
