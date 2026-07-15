"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  buildOAuth21PrunePreview,
} = require("../../src/auth/oauth21_prune_preview");
const {
  buildOAuth21PruneReceipt,
} = require("../../src/auth/oauth21_prune_receipt");
const {
  evaluateOAuth21PruneApplyReadiness,
} = require("../../src/auth/oauth21_prune_apply_gate");
const {
  buildOAuth21PruneApplyPackageDraft,
} = require("../../src/auth/oauth21_prune_apply_package_draft");
const {
  buildOAuth21PruneApplyPlan,
  executeOAuth21PruneApply,
} = require("../../src/auth/oauth21_prune_apply");

const ScriptDir = __dirname;
const Repo = path.resolve(ScriptDir, "..", "..");
const ControlPlaneRoot = path.join(Repo, "_workflow", "control_plane");
const RecordRoot = path.join(ControlPlaneRoot, "oauth21_prune_records");
const BackupRoot = path.join(ControlPlaneRoot, "oauth21_prune_backups");
const AuditLog = process.env.MCP_TEST_AUDIT_LOG || path.join(Repo, "_logs", ".mcp-tests-audit.jsonl");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function requireArg(args, key) {
  const value = String(args[key] || "").trim();
  if (!value) throw new Error(`Missing required argument --${key}`);
  return value;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readSqliteState(storagePath) {
  if (!storagePath || !fs.existsSync(storagePath)) {
    return { exists: false, clientsList: [], stateBody: { access: [], refresh: [], used_refresh: [] } };
  }
  const db = new DatabaseSync(storagePath);
  try {
    const clientsList = db.prepare("SELECT client_json FROM oauth21_clients").all().map((row) => JSON.parse(row.client_json));
    const access = db.prepare("SELECT token_json FROM oauth21_access_tokens").all().map((row) => JSON.parse(row.token_json));
    const refresh = db.prepare("SELECT token_json FROM oauth21_refresh_tokens").all().map((row) => JSON.parse(row.token_json));
    const usedRefresh = db.prepare("SELECT token_json FROM oauth21_used_refresh_tokens").all().map((row) => JSON.parse(row.token_json));
    return {
      exists: true,
      clientsList,
      stateBody: {
        access,
        refresh,
        used_refresh: usedRefresh,
      },
    };
  } finally {
    db.close();
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function writeAudit(event, level, data = {}) {
  fs.mkdirSync(path.dirname(AuditLog), { recursive: true });
  const entry = {
    ts: new Date().toISOString(),
    level,
    source: "test_mcp_oauth21_prune.js",
    event,
    action: event,
    pid: process.pid,
    ...data,
  };
  fs.appendFileSync(AuditLog, `${JSON.stringify(entry)}\n`, "utf8");
}

function removeEmptyParentDirs(pathValue) {
  let current = path.dirname(pathValue);
  while (current && current !== Repo && current.startsWith(Repo)) {
    if (fs.existsSync(current) && fs.readdirSync(current).length === 0) {
      fs.rmdirSync(current);
      current = path.dirname(current);
    } else {
      break;
    }
  }
}

function toClientMap(clientsList) {
  return new Map((Array.isArray(clientsList) ? clientsList : []).filter((item) => item?.client_id).map((item) => [String(item.client_id), item]));
}

function toTokenMap(items) {
  return new Map((Array.isArray(items) ? items : []).filter((item) => item?.token).map((item) => [String(item.token), item]));
}

function buildPackageFromFiles({
  oauthStoragePath = "",
  oauthStatePath,
  clientsPath,
  backupDir,
  operator,
  reason,
  approvalMarker = null,
  deadClientMinAgeMs,
  nowMs,
} = {}) {
  const resolvedStoragePath = String(oauthStoragePath || "").trim() ? path.resolve(oauthStoragePath) : "";
  const storageMode = resolvedStoragePath ? "sqlite" : "json";
  const sqliteState = storageMode === "sqlite" ? readSqliteState(resolvedStoragePath) : null;
  const stateBody = storageMode === "sqlite" ? sqliteState.stateBody : readJson(oauthStatePath, {});
  const clientsList = storageMode === "sqlite" ? sqliteState.clientsList : readJson(clientsPath, []);
  const preview = buildOAuth21PrunePreview({
    clients: toClientMap(clientsList),
    accessTokens: toTokenMap(stateBody.access),
    refreshTokens: toTokenMap(stateBody.refresh),
    usedRefreshTokens: toTokenMap(stateBody.used_refresh),
    pending: new Map(),
    codes: new Map(),
    nowMs,
    deadClientMinAgeMs,
    oauthStatePath: storageMode === "sqlite" ? resolvedStoragePath : oauthStatePath,
    clientsPath: storageMode === "sqlite" ? resolvedStoragePath : clientsPath,
  });
  const receipt = buildOAuth21PruneReceipt({
    preview,
    stage: "oauth21-prune-control-plane",
    operation: "preview",
    operator,
    reason,
  });
  const gate = evaluateOAuth21PruneApplyReadiness({
    preview,
    receipt,
    receiptVerified: true,
    operatorApproval: approvalMarker?.approved === true,
    backupConfigured: Boolean(String(backupDir || "").trim()),
    rollbackConfigured: true,
    auditRedactionReady: true,
    maintenanceWindowReady: true,
    authProfileAllowed: true,
  });
  const draft = buildOAuth21PruneApplyPackageDraft({ preview, receipt, gate });
  const plan = buildOAuth21PruneApplyPlan({
    preview,
    receipt,
    gate,
    approvalMarker: approvalMarker || {},
    stateBody,
    clientsList,
    oauthStoragePath: resolvedStoragePath,
    oauthStatePath: storageMode === "sqlite" ? resolvedStoragePath : oauthStatePath,
    clientsPath: storageMode === "sqlite" ? resolvedStoragePath : clientsPath,
    backupDir,
    nowMs,
    deadClientMinAgeMs,
  });
  return { preview, receipt, gate, draft, plan };
}

function statusMode() {
  const summary = {
    success: true,
    mode: "oauth21-prune-control-plane-status",
    record_root: RecordRoot,
    backup_root: BackupRoot,
    audit_log: AuditLog,
    record_root_exists: fs.existsSync(RecordRoot),
    backup_root_exists: fs.existsSync(BackupRoot),
  };
  console.log(JSON.stringify(summary));
}

function planMode(args) {
  const oauthStoragePath = String(args["oauth-storage-file"] || "").trim();
  const oauthStatePath = oauthStoragePath ? "" : requireArg(args, "oauth-state-file");
  const clientsPath = oauthStoragePath ? "" : requireArg(args, "oauth-clients-file");
  const operator = String(args.operator || "operator").trim() || "operator";
  const reason = String(args.reason || "manual oauth21 prune plan").trim();
  const nowMs = args["now-ms"] ? Number(args["now-ms"]) : Date.now();
  const deadClientMinAgeMs = (args["dead-client-min-age-days"] ? Number(args["dead-client-min-age-days"]) : 14) * 86400 * 1000;
  const runId = `${new Date(nowMs).toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(16).slice(2, 10)}`;
  const backupDir = args["backup-dir"] ? path.resolve(args["backup-dir"]) : path.join(BackupRoot, runId);
  const approvalMarker = args["approval-marker-file"] ? readJson(path.resolve(args["approval-marker-file"]), null) : null;

  const bundle = buildPackageFromFiles({
    oauthStoragePath: oauthStoragePath ? path.resolve(oauthStoragePath) : "",
    oauthStatePath: oauthStatePath ? path.resolve(oauthStatePath) : "",
    clientsPath: clientsPath ? path.resolve(clientsPath) : "",
    backupDir,
    operator,
    reason,
    approvalMarker,
    deadClientMinAgeMs,
    nowMs,
  });

  const record = {
    schema_version: "oauth21-prune-control-plane-record-v1",
    mode: "plan",
    run_id: runId,
    created_at: new Date(nowMs).toISOString(),
    oauth_storage_file: oauthStoragePath ? path.resolve(oauthStoragePath) : "",
    oauth_state_file: oauthStatePath ? path.resolve(oauthStatePath) : "",
    oauth_clients_file: clientsPath ? path.resolve(clientsPath) : "",
    backup_dir: backupDir,
    operator,
    reason,
    preview: bundle.preview,
    receipt: bundle.receipt,
    gate: bundle.gate,
    draft: bundle.draft,
    plan: bundle.plan,
  };
  const out = path.join(RecordRoot, `${runId}.plan.json`);
  writeJson(out, record);
  writeAudit("oauth21_prune_plan_ok", "info", { run_id: runId, plan_file: out, total_candidates: bundle.plan.candidate_counts?.total_candidates || 0 });
  console.log(`PLAN RECORD: ${out}`);
}

function executeMode(args) {
  const oauthStoragePath = String(args["oauth-storage-file"] || "").trim();
  const oauthStatePath = oauthStoragePath ? "" : requireArg(args, "oauth-state-file");
  const clientsPath = oauthStoragePath ? "" : requireArg(args, "oauth-clients-file");
  const approvalMarkerFile = requireArg(args, "approval-marker-file");
  const operator = String(args.operator || "operator").trim() || "operator";
  const reason = String(args.reason || "manual oauth21 prune execute").trim();
  const nowMs = args["now-ms"] ? Number(args["now-ms"]) : Date.now();
  const deadClientMinAgeMs = (args["dead-client-min-age-days"] ? Number(args["dead-client-min-age-days"]) : 14) * 86400 * 1000;
  const runId = `${new Date(nowMs).toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(16).slice(2, 10)}`;
  const backupDir = args["backup-dir"] ? path.resolve(args["backup-dir"]) : path.join(BackupRoot, runId);
  const approvalMarker = readJson(path.resolve(approvalMarkerFile), null);

  const bundle = buildPackageFromFiles({
    oauthStoragePath: oauthStoragePath ? path.resolve(oauthStoragePath) : "",
    oauthStatePath: oauthStatePath ? path.resolve(oauthStatePath) : "",
    clientsPath: clientsPath ? path.resolve(clientsPath) : "",
    backupDir,
    operator,
    reason,
    approvalMarker,
    deadClientMinAgeMs,
    nowMs,
  });

  const execution = executeOAuth21PruneApply({
    preview: bundle.preview,
    receipt: bundle.receipt,
    gate: bundle.gate,
    approvalMarker,
    oauthStoragePath: oauthStoragePath ? path.resolve(oauthStoragePath) : "",
    oauthStatePath: oauthStatePath ? path.resolve(oauthStatePath) : "",
    clientsPath: clientsPath ? path.resolve(clientsPath) : "",
    backupDir,
    nowMs,
    deadClientMinAgeMs,
  });

  const record = {
    schema_version: "oauth21-prune-control-plane-record-v1",
    mode: "execute",
    run_id: runId,
    created_at: new Date(nowMs).toISOString(),
    oauth_storage_file: oauthStoragePath ? path.resolve(oauthStoragePath) : "",
    oauth_state_file: oauthStatePath ? path.resolve(oauthStatePath) : "",
    oauth_clients_file: clientsPath ? path.resolve(clientsPath) : "",
    backup_dir: backupDir,
    operator,
    reason,
    preview: bundle.preview,
    receipt: bundle.receipt,
    gate: bundle.gate,
    draft: bundle.draft,
    plan: bundle.plan,
    execution,
  };
  const suffix = execution.success ? "executed" : "denied";
  const out = path.join(RecordRoot, `${runId}.${suffix}.json`);
  writeJson(out, record);
  writeAudit(execution.success ? "oauth21_prune_execute_ok" : "oauth21_prune_execute_denied", execution.success ? "info" : "warn", {
    run_id: runId,
    record_file: out,
    total_candidates: bundle.plan.candidate_counts?.total_candidates || 0,
  });
  console.log(`${execution.success ? "EXECUTED" : "DENIED"} RECORD: ${out}`);
}

function rollbackMode(args) {
  const recordFile = requireArg(args, "record-file");
  const whatIfOnly = args["what-if-only"] === true;
  const record = readJson(path.resolve(recordFile), null);
  if (!record || record.mode !== "execute") throw new Error(`Rollback requires execute record: ${recordFile}`);
  if (!record.execution || record.execution.success !== true) throw new Error(`Execute record is not successful: ${recordFile}`);

  const execution = record.execution;
  const backupPaths = execution.backup_paths || {};
  const receiptPaths = execution.receipt_paths || {};
  if (!receiptPaths.rollback_receipt) throw new Error("Rollback receipt path missing in execute record.");
  const rollbackReceipt = readJson(receiptPaths.rollback_receipt, null);
  if (!rollbackReceipt) throw new Error(`Rollback receipt missing: ${receiptPaths.rollback_receipt}`);

  const oauthStoragePath = String(record.oauth_storage_file || "");
  const oauthStatePath = String(record.oauth_state_file || "");
  const clientsPath = String(record.oauth_clients_file || "");
  const storageBackupPath = String(backupPaths.oauth_storage_backup || "");
  const stateBackupPath = String(backupPaths.oauth_state_backup || "");
  const clientsBackupPath = String(backupPaths.oauth_clients_backup || "");

  const files = [];
  if (oauthStoragePath) {
    if (storageBackupPath && fs.existsSync(storageBackupPath)) {
      const before = fs.existsSync(oauthStoragePath) ? fs.readFileSync(oauthStoragePath) : null;
      if (!whatIfOnly) fs.copyFileSync(storageBackupPath, oauthStoragePath);
      const after = fs.existsSync(oauthStoragePath) ? fs.readFileSync(oauthStoragePath) : before;
      const shaBefore = before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null;
      const shaAfter = after ? require("node:crypto").createHash("sha256").update(after).digest("hex").slice(0, 16) : null;
      files.push({
        target: oauthStoragePath,
        action: "restore_sqlite",
        backup: storageBackupPath,
        target_sha256_before: shaBefore,
        target_sha256_after: shaAfter,
        applied: !whatIfOnly,
      });
    } else {
      const existed = fs.existsSync(oauthStoragePath);
      const before = existed ? fs.readFileSync(oauthStoragePath) : null;
      if (existed && !whatIfOnly) {
        fs.rmSync(oauthStoragePath, { force: true });
        removeEmptyParentDirs(oauthStoragePath);
      }
      files.push({
        target: oauthStoragePath,
        action: existed ? "delete_new_sqlite_file" : "already_absent",
        backup: null,
        target_sha256_before: before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null,
        target_sha256_after: existed && !whatIfOnly ? null : (before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null),
        applied: existed && !whatIfOnly,
      });
    }
  }

  if (oauthStatePath) {
    if (stateBackupPath && fs.existsSync(stateBackupPath)) {
      const before = fs.existsSync(oauthStatePath) ? fs.readFileSync(oauthStatePath, "utf8") : "";
      if (!whatIfOnly) fs.copyFileSync(stateBackupPath, oauthStatePath);
      const after = fs.existsSync(oauthStatePath) ? fs.readFileSync(oauthStatePath, "utf8") : before;
      files.push({
        target: oauthStatePath,
        action: "restore",
        backup: stateBackupPath,
        target_sha256_before: before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null,
        target_sha256_after: after ? require("node:crypto").createHash("sha256").update(after).digest("hex").slice(0, 16) : null,
        applied: !whatIfOnly,
      });
    } else {
      const existed = fs.existsSync(oauthStatePath);
      const before = existed ? fs.readFileSync(oauthStatePath, "utf8") : "";
      if (existed && !whatIfOnly) {
        fs.rmSync(oauthStatePath, { force: true });
        removeEmptyParentDirs(oauthStatePath);
      }
      files.push({
        target: oauthStatePath,
        action: existed ? "delete_new_file" : "already_absent",
        backup: null,
        target_sha256_before: before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null,
        target_sha256_after: existed && !whatIfOnly ? null : (before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null),
        applied: existed && !whatIfOnly,
      });
    }
  }

  if (clientsPath) {
    if (clientsBackupPath && fs.existsSync(clientsBackupPath)) {
      const before = fs.existsSync(clientsPath) ? fs.readFileSync(clientsPath, "utf8") : "";
      if (!whatIfOnly) fs.copyFileSync(clientsBackupPath, clientsPath);
      const after = fs.existsSync(clientsPath) ? fs.readFileSync(clientsPath, "utf8") : before;
      files.push({
        target: clientsPath,
        action: "restore",
        backup: clientsBackupPath,
        target_sha256_before: before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null,
        target_sha256_after: after ? require("node:crypto").createHash("sha256").update(after).digest("hex").slice(0, 16) : null,
        applied: !whatIfOnly,
      });
    } else {
      const existed = fs.existsSync(clientsPath);
      const before = existed ? fs.readFileSync(clientsPath, "utf8") : "";
      if (existed && !whatIfOnly) {
        fs.rmSync(clientsPath, { force: true });
        removeEmptyParentDirs(clientsPath);
      }
      files.push({
        target: clientsPath,
        action: existed ? "delete_new_file" : "already_absent",
        backup: null,
        target_sha256_before: before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null,
        target_sha256_after: existed && !whatIfOnly ? null : (before ? require("node:crypto").createHash("sha256").update(before).digest("hex").slice(0, 16) : null),
        applied: existed && !whatIfOnly,
      });
    }
  }

  const suffix = whatIfOnly ? "rollback-dry-run" : "rollback";
  const out = path.join(RecordRoot, `${record.run_id}.${suffix}.json`);
  const rollbackRecord = {
    schema_version: "oauth21-prune-control-plane-record-v1",
    mode: "rollback",
    run_id: record.run_id,
    rolled_back_at: new Date().toISOString(),
    status: whatIfOnly ? "rollback_dry_run" : "rolled_back",
    source_execute_record: path.resolve(recordFile),
    rollback_receipt_path: receiptPaths.rollback_receipt,
    files,
  };
  writeJson(out, rollbackRecord);
  writeAudit("oauth21_prune_rollback_finish", "info", { rollback_file: out, status: rollbackRecord.status, file_count: files.length });
  console.log(`ROLLBACK RECORD: ${out}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = String(args.mode || "Status").trim();
  fs.mkdirSync(RecordRoot, { recursive: true });
  fs.mkdirSync(BackupRoot, { recursive: true });

  writeAudit("oauth21_prune_control_plane_start", "info", { mode });
  if (mode === "Status") return statusMode();
  if (mode === "Plan") return planMode(args);
  if (mode === "Execute") return executeMode(args);
  if (mode === "Rollback") return rollbackMode(args);
  throw new Error(`Unsupported mode: ${mode}`);
}

try {
  main();
  writeAudit("oauth21_prune_control_plane_finish", "info", { status: "ok" });
} catch (error) {
  writeAudit("oauth21_prune_control_plane_error", "error", { error: error?.message || String(error) });
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}
