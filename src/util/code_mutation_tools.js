"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const {
  auditGraph,
  buildDependencyGraph,
  codeSymbols,
  impactGraph,
  orchestrationPlan,
  patchPlan,
  scenarioPlan,
  syntaxCheck,
} = require("./code_workspace");
const { editFilePatch, resolveWritableWorkspacePath } = require("./workspace_mutation");
const { safeWorkspacePath } = require("./workspace_roots");

const AUDIT_LOG_REL = ".mcp_audit/actions.jsonl";
const WRITABLE_APPLY_STATUSES = new Set(["committed_after_validation"]);

function newOperationId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

async function appendActionLedger(record) {
  const full = safeWorkspacePath(AUDIT_LOG_REL).absolutePath;
  await fs.mkdir(path.dirname(full), { recursive: true });
  const entry = { timestamp: new Date().toISOString(), ...record };
  await fs.appendFile(full, JSON.stringify(entry) + "\n", "utf8");
}

async function readActionLedger() {
  const full = safeWorkspacePath(AUDIT_LOG_REL).absolutePath;
  try {
    const text = await fs.readFile(full, "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function findLedgerEntry(records, operationId) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]?.operation_id === operationId) return records[index];
  }
  return null;
}

async function restoreBackupToTarget(targetPath, backupPath) {
  const targetResolved = resolveWritableWorkspacePath(targetPath);
  const backupResolved = safeWorkspacePath(backupPath);
  const restored = await fs.readFile(backupResolved.absolutePath, "utf8");
  await fs.writeFile(targetResolved.absolutePath, restored, "utf8");
  return {
    target: targetResolved.displayPath,
    restored_from: backupResolved.displayPath,
    bytes_after: Buffer.byteLength(restored, "utf8"),
  };
}

async function buildPatchPlan(args = {}) {
  const graph = await buildDependencyGraph(args.path, {
    recursive: args.recursive !== false,
    maxFiles: args.max_files || 500,
  });
  return {
    graph,
    plan: patchPlan(
      graph,
      args.target,
      args.intent || "refactor",
      args.objective || "",
      args.direction || "both",
      args.max_depth || 5,
    ),
  };
}

async function executeCodeApplyPatch(args = {}) {
  const operationId = newOperationId();
  const commitRef = typeof args.commit_ref === "string" && args.commit_ref.trim() ? args.commit_ref.trim() : "";
  const dryRun = args.dry_run !== false;
  const confirm = args.confirm === true;
  const baseAudit = {
    operation_id: operationId,
    tool: "code_apply_patch",
    requested_scope: String(args.path || ""),
    requested_target: String(args.target || ""),
    mode: String(args.mode || "replace"),
    dry_run: dryRun,
    confirm,
    commit_ref: commitRef || null,
    anchor_hash: hashText(args.anchor),
    content_hash: hashText(args.content),
  };

  const { graph, plan } = await buildPatchPlan(args);
  if (plan.decision?.status === "blocked") {
    await appendActionLedger({ ...baseAudit, status: "plan_blocked", applied: false, plan_status: plan.decision?.status || "blocked" });
    return {
      success: false,
      error: "Patch plan blocked.",
      status: "blocked",
      applied: false,
      operation_id: operationId,
      scope: graph.path,
      plan,
    };
  }

  const targetPath = plan.scenario?.target || plan.patch_scope?.target || String(args.target || "");
  const dryRunPatch = await editFilePatch(targetPath, {
    anchor: args.anchor,
    content: args.content,
    mode: args.mode || "replace",
    dry_run: true,
    allow_protected: args.allow_protected === true,
    require_markers: Array.isArray(args.require_markers) ? args.require_markers : [],
  });

  const readyPayload = {
    success: true,
    error: "",
    status: "ready_to_apply",
    applied: false,
    operation_id: operationId,
    scope: graph.path,
    target: targetPath,
    mode: dryRunPatch.mode,
    anchor_matches: dryRunPatch.anchor_matches,
    bytes_before: dryRunPatch.bytes_before,
    bytes_after: dryRunPatch.bytes_after,
    delta_bytes: dryRunPatch.delta_bytes,
    dry_run: dryRun,
    plan,
  };

  if (dryRun) {
    await appendActionLedger({
      ...baseAudit,
      status: "dry_run_ready",
      applied: false,
      target: targetPath,
      bytes_before: dryRunPatch.bytes_before,
      bytes_after: dryRunPatch.bytes_after,
      delta_bytes: dryRunPatch.delta_bytes,
    });
    return readyPayload;
  }

  if (!confirm) {
    await appendActionLedger({ ...baseAudit, status: "confirmation_required", applied: false, target: targetPath });
    return {
      ...readyPayload,
      success: false,
      error: "confirm=true is required when dry_run=false.",
      status: "confirmation_required",
    };
  }

  if (!commitRef) {
    await appendActionLedger({ ...baseAudit, status: "commit_ref_missing", applied: false, target: targetPath });
    return {
      ...readyPayload,
      success: false,
      error: "commit_ref is required when dry_run=false.",
      status: "commit_ref_missing",
    };
  }

  const records = await readActionLedger();
  const reference = findLedgerEntry(records, commitRef);
  if (!reference || reference.status !== "dry_run_ready") {
    await appendActionLedger({ ...baseAudit, status: "commit_ref_invalid", applied: false, target: targetPath });
    return {
      ...readyPayload,
      success: false,
      error: "commit_ref must reference an earlier dry_run_ready operation.",
      status: "commit_ref_invalid",
    };
  }

  if (
    reference.target !== targetPath
    || reference.anchor_hash !== baseAudit.anchor_hash
    || reference.content_hash !== baseAudit.content_hash
    || reference.mode !== baseAudit.mode
  ) {
    await appendActionLedger({ ...baseAudit, status: "commit_integrity_violation", applied: false, target: targetPath });
    return {
      ...readyPayload,
      success: false,
      error: "commit_ref does not match target/mode/content of this apply request.",
      status: "commit_integrity_violation",
    };
  }

  const committedPatch = await editFilePatch(targetPath, {
    anchor: args.anchor,
    content: args.content,
    mode: args.mode || "replace",
    dry_run: false,
    allow_protected: args.allow_protected === true,
    require_markers: Array.isArray(args.require_markers) ? args.require_markers : [],
  });
  const validation = await syntaxCheck(targetPath);

  if (!validation.ok) {
    if (committedPatch.backup) {
      await restoreBackupToTarget(targetPath, committedPatch.backup);
    }
    await appendActionLedger({
      ...baseAudit,
      status: "auto_rolled_back_validation_error",
      applied: false,
      target: targetPath,
      backup: committedPatch.backup,
      validation,
    });
    return {
      ...readyPayload,
      success: false,
      error: validation.stderr || validation.stdout || "Syntax validation failed after patch.",
      status: "auto_rolled_back_validation_error",
      backup: committedPatch.backup,
      validation,
    };
  }

  await appendActionLedger({
    ...baseAudit,
    status: "committed_after_validation",
    applied: true,
    source_operation: commitRef,
    target: targetPath,
    backup: committedPatch.backup,
    bytes_before: committedPatch.bytes_before,
    bytes_after: committedPatch.bytes_after,
    delta_bytes: committedPatch.delta_bytes,
    validation,
  });
  return {
    ...readyPayload,
    status: "committed_after_validation",
    applied: true,
    backup: committedPatch.backup,
    validation,
  };
}

async function executeCodeRollbackPatch(args = {}) {
  const rollbackId = newOperationId();
  const sourceOperation = String(args.operation_id || "").trim();
  const confirm = args.confirm === true;
  const baseAudit = {
    operation_id: rollbackId,
    tool: "code_rollback_patch",
    source_operation: sourceOperation,
    confirm,
  };

  if (!sourceOperation) {
    await appendActionLedger({ ...baseAudit, status: "source_not_found", applied: false });
    return { success: false, error: "operation_id is required.", status: "blocked", applied: false };
  }
  if (!confirm) {
    await appendActionLedger({ ...baseAudit, status: "confirmation_required", applied: false });
    return { success: false, error: "confirm=true is required for rollback.", status: "confirmation_required", applied: false };
  }

  const records = await readActionLedger();
  const source = findLedgerEntry(records, sourceOperation);
  if (!source || !WRITABLE_APPLY_STATUSES.has(source.status) || source.applied !== true) {
    await appendActionLedger({ ...baseAudit, status: "source_not_rollbackable", applied: false, source_status: source?.status || null });
    return {
      success: false,
      error: "Only committed_after_validation operations can be rolled back.",
      status: "blocked",
      applied: false,
      source_status: source?.status || null,
    };
  }

  const alreadyRolledBack = records.some((item) => item?.tool === "code_rollback_patch" && item?.source_operation === sourceOperation && item?.status === "rolled_back");
  if (alreadyRolledBack) {
    await appendActionLedger({ ...baseAudit, status: "already_rolled_back", applied: false, target: source.target, backup: source.backup });
    return {
      success: false,
      error: "Source operation is already rolled back.",
      status: "blocked",
      applied: false,
      target: source.target,
      backup: source.backup,
    };
  }

  if (!source.backup) {
    await appendActionLedger({ ...baseAudit, status: "missing_backup", applied: false, target: source.target });
    return {
      success: false,
      error: "Source operation has no backup.",
      status: "blocked",
      applied: false,
      target: source.target,
    };
  }

  const targetResolved = resolveWritableWorkspacePath(source.target);
  const before = await fs.readFile(targetResolved.absolutePath, "utf8");
  const restored = await restoreBackupToTarget(source.target, source.backup);
  const bytesBefore = Buffer.byteLength(before, "utf8");
  await appendActionLedger({
    ...baseAudit,
    status: "rolled_back",
    applied: true,
    target: source.target,
    backup: source.backup,
    bytes_before: bytesBefore,
    bytes_after: restored.bytes_after,
  });
  return {
    success: true,
    error: "",
    status: "rolled_back",
    applied: true,
    operation_id: rollbackId,
    source_operation: sourceOperation,
    target: source.target,
    restored_from: source.backup,
    bytes_before: bytesBefore,
    bytes_after: restored.bytes_after,
  };
}

async function executeCodeOrchestrate(args = {}) {
  const graph = await buildDependencyGraph(args.path, {
    recursive: args.recursive !== false,
    maxFiles: args.max_files || 500,
  });
  return {
    success: true,
    error: "",
    scope: graph.path,
    direction: args.direction || "both",
    max_depth: args.max_depth || 5,
    graph: { nodes: graph.nodes_count, edges: graph.edges_count, truncated: graph.truncated },
    ...orchestrationPlan(
      graph,
      args.target,
      args.intent || "refactor",
      args.objective || "",
      args.direction || "both",
      args.max_depth || 5,
    ),
  };
}

async function executeToolDispatch(args = {}) {
  const tool = String(args.tool || "").trim();
  const input = args.input && typeof args.input === "object" ? args.input : {};
  const operation = String(input.operation || "").trim();

  if (tool !== "code_analysis") {
    return {
      success: false,
      error: "Only tool=code_analysis is supported.",
      status: "unsupported_tool",
      tool,
      operation,
    };
  }

  const graphArgs = {
    path: input.scope || input.path,
    recursive: input.limits?.recursive !== false,
    max_files: input.limits?.max_files || 500,
    max_depth: input.limits?.max_depth || 5,
    direction: input.limits?.direction || "both",
    target: input.target,
    objective: input.objective,
    intent: input.intent,
    anchor: input.anchor,
    content: input.content,
    mode: input.mode,
    require_markers: input.require_markers,
    confirm: input.confirm,
    dry_run: input.commit_ref ? false : input.dry_run,
    commit_ref: input.commit_ref,
    operation_id: input.operation_id,
  };

  let result;
  switch (operation) {
    case "symbols": {
      result = await codeSymbols(graphArgs.path);
      break;
    }
    case "dependencies": {
      result = await buildDependencyGraph(graphArgs.path, { recursive: graphArgs.recursive, maxFiles: graphArgs.max_files });
      break;
    }
    case "audit": {
      const graph = await buildDependencyGraph(graphArgs.path, { recursive: graphArgs.recursive, maxFiles: graphArgs.max_files });
      result = { path: graph.path, recursive: graph.recursive, max_files: graph.max_files, ...auditGraph(graph, 20) };
      break;
    }
    case "impact": {
      const graph = await buildDependencyGraph(graphArgs.path, { recursive: graphArgs.recursive, maxFiles: graphArgs.max_files });
      result = {
        scope: graph.path,
        direction: graphArgs.direction,
        max_depth: graphArgs.max_depth,
        graph: { nodes: graph.nodes_count, edges: graph.edges_count, truncated: graph.truncated },
        ...impactGraph(graph, graphArgs.target, graphArgs.direction, graphArgs.max_depth),
      };
      break;
    }
    case "scenario": {
      const graph = await buildDependencyGraph(graphArgs.path, { recursive: graphArgs.recursive, maxFiles: graphArgs.max_files });
      const changeType = input.change_type || "internal_refactor";
      result = {
        scope: graph.path,
        change_type: changeType,
        direction: graphArgs.direction,
        max_depth: graphArgs.max_depth,
        graph: { nodes: graph.nodes_count, edges: graph.edges_count, truncated: graph.truncated },
        ...scenarioPlan(graph, graphArgs.target, changeType, graphArgs.direction, graphArgs.max_depth),
      };
      break;
    }
    case "patch_plan": {
      const built = await buildPatchPlan(graphArgs);
      result = built.plan;
      break;
    }
    case "orchestrate": {
      result = await executeCodeOrchestrate(graphArgs);
      break;
    }
    case "apply_patch": {
      result = await executeCodeApplyPatch(graphArgs);
      break;
    }
    case "rollback_patch": {
      result = await executeCodeRollbackPatch({ operation_id: graphArgs.operation_id, confirm: graphArgs.confirm });
      break;
    }
    default:
      return {
        success: false,
        error: `Unsupported code_analysis operation: ${operation || "(empty)"}`,
        status: "unsupported_operation",
        tool,
        operation,
      };
  }

  return {
    success: true,
    error: "",
    status: "ok",
    tool,
    operation,
    result,
  };
}

module.exports = {
  executeCodeApplyPatch,
  executeCodeOrchestrate,
  executeCodeRollbackPatch,
  executeToolDispatch,
  readActionLedger,
};
