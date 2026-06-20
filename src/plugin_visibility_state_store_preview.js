const crypto = require("node:crypto");
const {
  STATE_STORE_VERSION,
  lookupVisibilityState,
  normalizeStateStore,
  planVisibilityStateTransition,
  validateStateRecord,
} = require("./plugin_visibility_state");

const STATE_STORE_PREVIEW_VERSION = "test-mcp-plugin-visibility-state-store-preview-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function canonicalStateStore(store = {}) {
  const normalized = normalizeStateStore(store);
  return {
    version: STATE_STORE_VERSION,
    records: [...normalized.records].sort((a, b) => a.tool_name.localeCompare(b.tool_name)),
  };
}

function stateStoreHash(store = {}) {
  return hashJson(canonicalStateStore(store));
}

function upsertStateRecord({ store = {}, record } = {}) {
  const normalized = normalizeStateStore(store);
  const validation = validateStateRecord(record, { allowEmptyMetadata: false });
  const records = normalized.records.filter((item) => item.tool_name !== String(record?.tool_name || "").trim());
  const errors = [...normalized.errors];
  const warnings = [...normalized.warnings];

  if (!validation.ok) {
    errors.push(...validation.errors);
  } else {
    records.push({
      tool_name: String(record.tool_name || "").trim(),
      state: String(record.state || "").trim().toLowerCase(),
      source: String(record.source || "operator-state-store"),
      updated_at: String(record.updated_at || ""),
      updated_by: String(record.updated_by || ""),
      reason: String(record.reason || ""),
    });
    warnings.push(...validation.warnings);
  }

  return {
    state_store_version: STATE_STORE_VERSION,
    ok: errors.length === 0,
    errors,
    warnings,
    records: records.sort((a, b) => a.tool_name.localeCompare(b.tool_name)),
  };
}

function buildStateStoreWritePlan({ stateStorePath = "", currentStore = {}, proposedStore = {}, operation = "preview" } = {}) {
  const beforeHash = stateStoreHash(currentStore);
  const afterHash = stateStoreHash(proposedStore);
  const wouldWrite = beforeHash !== afterHash;
  return {
    success: true,
    mode: "plugin-visibility-state-store-write-plan-preview-only",
    state_store_preview_version: STATE_STORE_PREVIEW_VERSION,
    state_store_path_recorded: Boolean(String(stateStorePath || "").trim()),
    state_store_path_hash: String(stateStorePath || "").trim() ? hashJson(String(stateStorePath || "")) : "",
    operation: String(operation || "preview"),
    before_hash: beforeHash,
    after_hash: afterHash,
    would_write: wouldWrite,
    atomic_write_required: wouldWrite,
    temp_file_required: wouldWrite,
    backup_required: wouldWrite,
    fs_write_enabled_now: false,
    execute_allowed_now: false,
    raw_path_redacted: true,
    required_steps: wouldWrite
      ? ["validate current store", "write temp file", "fsync temp file", "rename temp file atomically", "write rollback receipt"]
      : [],
    blockers: wouldWrite ? ["state-store persistence is preview-only in Stage 8 / Step 40"] : [],
  };
}

function buildRollbackMetadata({ toolName = "", fromState = "", toState = "", beforeHash = "", afterHash = "", operator = "", reason = "" } = {}) {
  const metadata = {
    version: STATE_STORE_PREVIEW_VERSION,
    tool_name: String(toolName || "").trim(),
    from_state: String(fromState || "").trim().toLowerCase(),
    to_state: String(toState || "").trim().toLowerCase(),
    before_hash: String(beforeHash || ""),
    after_hash: String(afterHash || ""),
    operator_recorded: Boolean(String(operator || "").trim()),
    reason_recorded: Boolean(String(reason || "").trim()),
    rollback_required_for_quarantine: String(toState || "").trim().toLowerCase() === "quarantined",
    raw_store_redacted: true,
  };
  return {
    ...metadata,
    rollback_hash: hashJson(metadata),
  };
}

function planPersistentVisibilityStateChange({
  currentStore = {},
  toolName = "",
  targetState = "candidate",
  operator = "",
  reason = "",
  now = "",
  stateStorePath = "",
} = {}) {
  const current = lookupVisibilityState(toolName, currentStore);
  const transition = planVisibilityStateTransition({
    toolName,
    currentState: current.state,
    targetState,
    operator,
    reason,
  });
  const proposedRecord = {
    tool_name: String(toolName || "").trim(),
    state: String(targetState || "").trim().toLowerCase(),
    source: "operator-state-store",
    updated_at: String(now || ""),
    updated_by: String(operator || ""),
    reason: String(reason || ""),
  };
  const proposedStore = upsertStateRecord({ store: currentStore, record: proposedRecord });
  const writePlan = buildStateStoreWritePlan({
    stateStorePath,
    currentStore,
    proposedStore,
    operation: "visibility_state_change",
  });
  const rollback = buildRollbackMetadata({
    toolName,
    fromState: current.state,
    toState: targetState,
    beforeHash: writePlan.before_hash,
    afterHash: writePlan.after_hash,
    operator,
    reason,
  });

  return {
    success: transition.success && proposedStore.ok,
    error: [...(transition.errors || []), ...(proposedStore.errors || [])].join("; "),
    mode: "plugin-visibility-persistent-state-store-preview-only",
    state_store_preview_version: STATE_STORE_PREVIEW_VERSION,
    state_store_version: STATE_STORE_VERSION,
    tool_name: String(toolName || "").trim(),
    current_state: current.state,
    target_state: String(targetState || "").trim().toLowerCase(),
    would_change_state: transition.would_change_state === true,
    would_change_tools_list: transition.would_change_tools_list === true,
    would_require_list_changed: transition.would_require_list_changed === true,
    proposed_store_ok: proposedStore.ok,
    proposed_record: proposedRecord,
    proposed_record_hash: hashJson(proposedRecord),
    proposed_store_hash: stateStoreHash(proposedStore),
    write_plan: writePlan,
    rollback,
    fs_write_enabled_now: false,
    execute_allowed_now: false,
    real_mutation_enabled: false,
    list_changed_enabled_now: false,
    dynamic_import_enabled: false,
    raw_store_redacted: true,
    blockers: [
      ...(transition.execute_allowed_now === false && transition.would_change_state ? ["state-store persistence is preview-only in Stage 8 / Step 40"] : []),
      ...(transition.would_require_list_changed ? ["notifications/tools/list_changed emission is disabled"] : []),
    ],
    warnings: [...(transition.warnings || []), ...(proposedStore.warnings || [])],
    required_approvals: transition.required_approvals || [],
  };
}

module.exports = {
  STATE_STORE_PREVIEW_VERSION,
  buildRollbackMetadata,
  buildStateStoreWritePlan,
  canonicalStateStore,
  planPersistentVisibilityStateChange,
  stateStoreHash,
  upsertStateRecord,
};
