"use strict";

const {
  createStateHandleStore,
  hashValue,
} = require("./state_handle_prototype");

const CONFIRMATION_KIND = "cbm_delete_project_confirmation";
const DEFAULT_CONFIRMATION_TTL_MS = 120000;

function normalizeAuthContext(value = {}) {
  return {
    subject: String(value.subject || "anonymous"),
    clientId: String(value.clientId || value.client_id || "unknown_client"),
    audience: String(value.audience || "mcp-tools"),
    profile: String(value.profile || "unknown"),
    scopes: Array.isArray(value.scopes) ? value.scopes.map(String) : [],
  };
}

function invalid(reason, summary = null) {
  return {
    allow: false,
    code: "cbm_confirmation_invalid",
    reason: String(reason || "confirmation_invalid"),
    summary,
  };
}

function createDestructiveToolConfirmationManager({
  now = () => Date.now(),
  ttlMs = DEFAULT_CONFIRMATION_TTL_MS,
  store = createStateHandleStore({ now }),
} = {}) {
  const boundedTtlMs = Math.max(1000, Math.min(Number(ttlMs) || DEFAULT_CONFIRMATION_TTL_MS, 10 * 60 * 1000));

  function evaluate({
    toolName,
    project,
    confirm = false,
    stateHandle = "",
    authContext = {},
  } = {}) {
    const safeToolName = String(toolName || "");
    const safeProject = String(project || "").trim();
    const safeAuth = normalizeAuthContext(authContext);

    if (safeToolName !== "cbm_delete_project" || !safeProject) {
      return invalid("unsupported_confirmation_target");
    }

    if (confirm !== true) {
      const created = store.create({
        kind: CONFIRMATION_KIND,
        ttlMs: boundedTtlMs,
        authContext: safeAuth,
        payload: {
          tool_name: safeToolName,
          project: safeProject,
          project_sha256: hashValue(safeProject),
        },
      });
      return {
        allow: false,
        code: "cbm_confirmation_required",
        reason: "explicit_confirmation_required",
        challenge: {
          kind: CONFIRMATION_KIND,
          state_handle: created.handle,
          expires_in_ms: boundedTtlMs,
          project_sha256: hashValue(safeProject),
        },
      };
    }

    if (!stateHandle) return invalid("state_handle_missing");

    const read = store.read({
      handle: stateHandle,
      authContext: safeAuth,
      kind: CONFIRMATION_KIND,
    });
    if (!read.ok) return invalid(read.reason, read.summary || null);
    if (read.payload?.tool_name !== safeToolName || read.payload?.project !== safeProject) {
      return invalid("confirmation_target_mismatch", read.summary || null);
    }

    const consumed = store.destroy({
      handle: stateHandle,
      authContext: safeAuth,
      kind: CONFIRMATION_KIND,
    });
    if (!consumed.ok) return invalid(consumed.reason, consumed.summary || null);

    return {
      allow: true,
      code: "cbm_confirmation_accepted",
      reason: "one_time_confirmation_consumed",
      summary: consumed.summary,
    };
  }

  return {
    evaluate,
    size: () => store.size(),
  };
}

let defaultManager = createDestructiveToolConfirmationManager();

function getDefaultDestructiveToolConfirmationManager() {
  return defaultManager;
}

function resetDefaultDestructiveToolConfirmationManagerForTests(options = {}) {
  defaultManager = createDestructiveToolConfirmationManager(options);
  return defaultManager;
}

module.exports = {
  CONFIRMATION_KIND,
  DEFAULT_CONFIRMATION_TTL_MS,
  createDestructiveToolConfirmationManager,
  getDefaultDestructiveToolConfirmationManager,
  normalizeAuthContext,
  resetDefaultDestructiveToolConfirmationManagerForTests,
};
