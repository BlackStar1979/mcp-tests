const VISIBILITY_STATES = Object.freeze(["candidate", "enabled", "disabled", "quarantined"]);
const MUTATING_STATES = Object.freeze(["enabled", "disabled", "quarantined"]);
const STATE_STORE_VERSION = "test-mcp-plugin-visibility-state-v1";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeToolName(value) {
  return String(value || "").trim();
}

function normalizeState(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidVisibilityState(state) {
  return VISIBILITY_STATES.includes(normalizeState(state));
}

function defaultStateRecord(toolName, source = "manifest") {
  return {
    tool_name: normalizeToolName(toolName),
    state: "candidate",
    source,
    updated_at: "",
    updated_by: "",
    reason: "",
  };
}

function validateStateRecord(record, options = {}) {
  const errors = [];
  const warnings = [];
  const allowEmptyMetadata = options.allowEmptyMetadata !== false;

  if (!isPlainObject(record)) {
    return { ok: false, errors: ["record must be an object"], warnings: [] };
  }

  const toolName = normalizeToolName(record.tool_name);
  const state = normalizeState(record.state);
  if (!/^[a-zA-Z0-9_.-]{1,160}$/.test(toolName)) errors.push("tool_name must be a safe tool identifier");
  if (!isValidVisibilityState(state)) errors.push("state must be one of candidate, enabled, disabled, quarantined");

  if (!allowEmptyMetadata && MUTATING_STATES.includes(state)) {
    if (!String(record.updated_at || "").trim()) errors.push("updated_at is required for mutating states");
    if (!String(record.updated_by || "").trim()) errors.push("updated_by is required for mutating states");
    if (!String(record.reason || "").trim()) errors.push("reason is required for mutating states");
  }

  if (state === "enabled") warnings.push("enabled state is planning-only until real tools/list mutation is implemented");
  if (state === "quarantined") warnings.push("quarantined state requires rollback/audit handling before real mutation");

  return { ok: errors.length === 0, errors, warnings };
}

function normalizeStateStore(store = {}) {
  const rawRecords = Array.isArray(store.records) ? store.records : [];
  const records = [];
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (const record of rawRecords) {
    const validation = validateStateRecord(record);
    const toolName = normalizeToolName(record?.tool_name);
    if (seen.has(toolName)) errors.push(`duplicate state record: ${toolName}`);
    if (toolName) seen.add(toolName);
    if (!validation.ok) errors.push(...validation.errors.map((error) => `${toolName || "<unknown>"}: ${error}`));
    warnings.push(...validation.warnings.map((warning) => `${toolName || "<unknown>"}: ${warning}`));
    if (validation.ok) {
      records.push({
        tool_name: toolName,
        state: normalizeState(record.state),
        source: String(record.source || "operator-state-store"),
        updated_at: String(record.updated_at || ""),
        updated_by: String(record.updated_by || ""),
        reason: String(record.reason || ""),
      });
    }
  }

  return {
    state_store_version: STATE_STORE_VERSION,
    ok: errors.length === 0,
    errors,
    warnings,
    records,
  };
}

function lookupVisibilityState(toolName, store = {}) {
  const normalized = normalizeStateStore(store);
  const wanted = normalizeToolName(toolName);
  const record = normalized.records.find((item) => item.tool_name === wanted) || defaultStateRecord(wanted);
  return {
    ...record,
    state_store_ok: normalized.ok,
    state_store_errors: normalized.errors,
    state_store_warnings: normalized.warnings,
  };
}

function planVisibilityStateTransition({ toolName, currentState = "candidate", targetState, operator = "", reason = "" } = {}) {
  const safeToolName = normalizeToolName(toolName);
  const from = normalizeState(currentState || "candidate");
  const to = normalizeState(targetState);
  const errors = [];
  const warnings = [];
  const requiredApprovals = [];

  if (!/^[a-zA-Z0-9_.-]{1,160}$/.test(safeToolName)) errors.push("toolName must be a safe tool identifier");
  if (!isValidVisibilityState(from)) errors.push("currentState is invalid");
  if (!isValidVisibilityState(to)) errors.push("targetState is invalid");

  const changesToolsList = from === "enabled" || to === "enabled";
  const realMutationEnabled = false;

  if (to === "enabled") {
    requiredApprovals.push("explicit operator approval");
    requiredApprovals.push("tools/list diff review");
    requiredApprovals.push("client refresh or notifications/tools/list_changed workflow");
  }
  if (to === "quarantined") requiredApprovals.push("rollback/quarantine audit record");
  if (from === to) warnings.push("target state equals current state; no state diff would be produced");
  if (changesToolsList) warnings.push("transition would affect tools/list in a future stage but execution is disabled now");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    mode: "plugin-visibility-state-preview-only",
    state_store_version: STATE_STORE_VERSION,
    tool_name: safeToolName,
    current_state: from,
    target_state: to,
    would_change_state: errors.length === 0 && from !== to,
    would_change_tools_list: changesToolsList,
    would_require_list_changed: changesToolsList,
    real_mutation_enabled: realMutationEnabled,
    execute_allowed_now: false,
    operator_recorded: Boolean(String(operator || "").trim()),
    reason_recorded: Boolean(String(reason || "").trim()),
    errors,
    warnings,
    required_approvals: requiredApprovals,
  };
}

module.exports = {
  MUTATING_STATES,
  STATE_STORE_VERSION,
  VISIBILITY_STATES,
  defaultStateRecord,
  isValidVisibilityState,
  lookupVisibilityState,
  normalizeStateStore,
  planVisibilityStateTransition,
  validateStateRecord,
};
