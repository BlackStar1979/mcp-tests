"use strict";

const { PUBLIC_TOOL_NAMES, getToolPolicy } = require("../tool_policy");
const { resolveConsentRequirement } = require("./consent_runtime_policy");
const { getDefaultDestructiveToolConfirmationManager } = require("./destructive_tool_confirmation");

function buildJsonRpcError(code, message) {
  return {
    code,
    message,
  };
}


function denyDecision({ code, httpStatus = 403, rpcCode = -32602, message = "Tool call denied", reasons = [], responseData = {} }) {
  return {
    allow: false,
    deny_code: code,
    http_status: httpStatus,
    json_rpc_error: buildJsonRpcError(rpcCode, message),
    decision_meta: {
      policy: "decision-runtime-policy-v2",
      reason_codes: reasons.length ? reasons : [code],
    },
    response_data: responseData,
  };
}

function evaluateDecisionRuntimePolicy({
  decisionContext,
  destructiveConfirmationManager = getDefaultDestructiveToolConfirmationManager(),
} = {}) {
  const result = decisionContext && typeof decisionContext === "object" ? decisionContext : null;
  const context = result && result.context && typeof result.context === "object" ? result.context : null;
  const reasonCodes = Array.isArray(result?.reason_codes) ? [...result.reason_codes] : [];

  if (!result || result.ok !== true || !context) {
    return {
      allow: false,
      deny_code: reasonCodes[0] || "malformed_decision_context",
      http_status: 400,
      json_rpc_error: buildJsonRpcError(-32602, "Invalid tool call decision context"),
      decision_meta: {
        policy: "decision-runtime-policy-v1",
        reason_codes: reasonCodes.length ? reasonCodes : ["malformed_decision_context"],
      },
    };
  }

  if (context.known_tool !== true) {
    return {
      allow: false,
      deny_code: "unknown_tool",
      http_status: 400,
      json_rpc_error: buildJsonRpcError(-32602, `Unknown tool: ${context.tool}`),
      decision_meta: {
        policy: "decision-runtime-policy-v1",
        reason_codes: ["unknown_tool"],
      },
    };
  }

  const toolName = typeof context.tool === "string" ? context.tool : "unknown";
  const profile = typeof context.profile === "string" ? context.profile : "unknown";
  const authMode = typeof context.auth_mode === "string" ? context.auth_mode : "unknown";
  const toolPolicy = getToolPolicy(toolName);

  if (!toolPolicy) {
    return denyDecision({ code: "missing_tool_policy", message: `Missing policy for tool: ${toolName}` });
  }

  if (!Array.isArray(toolPolicy.profile_allowed) || !toolPolicy.profile_allowed.includes(profile)) {
    return denyDecision({ code: "profile_not_allowed", message: `Tool ${toolName} is not allowed in profile ${profile}` });
  }

  if (toolPolicy.auth_required === true && authMode === "none") {
    return denyDecision({ code: "auth_required", httpStatus: 401, message: `Tool ${toolName} requires authentication` });
  }

  if (authMode === "oauth21") {
    const requiredScope = profile === "internal"
      ? "mcp:tools"
      : profile === "operator"
        ? "mcp:operator"
        : null;
    const grantedScopes = Array.isArray(context.auth_context?.scopes)
      ? context.auth_context.scopes.map(String)
      : [];
    if (requiredScope && !grantedScopes.includes(requiredScope)) {
      return denyDecision({
        code: "insufficient_scope",
        message: `Tool ${toolName} requires scope ${requiredScope}`,
        responseData: { required_scopes: [requiredScope] },
      });
    }
  }

  if (profile === "public") {
    if (!PUBLIC_TOOL_NAMES.includes(toolName)) {
      return denyDecision({ code: "not_public_tool", message: `Tool ${toolName} is not public` });
    }
    if (toolPolicy.public_safe !== true) {
      return denyDecision({ code: "not_public_safe", message: `Tool ${toolName} is not public safe` });
    }
    if (toolPolicy.uses_fs === true && toolPolicy.fs_scope !== "public-fs-sandbox") {
      return denyDecision({ code: "invalid_public_fs_scope", message: `Tool ${toolName} has invalid public filesystem scope` });
    }
  }

  const consent = resolveConsentRequirement({ toolName, toolPolicy });
  if (consent.required === true) {
    if (consent.ok !== true || !consent.requirement) {
      return denyDecision({
        code: "consent_requirement_invalid",
        message: `Consent requirement for ${toolName} is invalid`,
        reasons: [String(consent.reason || "consent_requirement_invalid")],
      });
    }
    return {
      allow: true,
      deny_code: null,
      http_status: 200,
      json_rpc_error: null,
      response_data: {},
      mrtr_requirement: consent.requirement,
      decision_meta: {
        policy: "decision-runtime-policy-v3",
        reason_codes: ["human_consent_required"],
      },
    };
  }

  if (toolPolicy.destructive === true) {
    if (toolName !== "cbm_delete_project") {
      return denyDecision({ code: "destructive_tool_denied", message: `Tool ${toolName} is destructive` });
    }
    const confirmation = context.destructive_confirmation || {};
    const confirmationDecision = destructiveConfirmationManager.evaluate({
      toolName,
      project: confirmation.project,
      confirm: confirmation.confirm === true,
      stateHandle: confirmation.state_handle || "",
      authContext: context.auth_context || {},
    });
    if (confirmationDecision.allow !== true) {
      return denyDecision({
        code: confirmationDecision.code,
        message: confirmationDecision.code === "cbm_confirmation_required"
          ? "Explicit confirmation is required for CBM project deletion"
          : "CBM deletion confirmation is invalid or expired",
        reasons: [confirmationDecision.code],
        responseData: confirmationDecision.challenge || { confirmation_reason: confirmationDecision.reason },
      });
    }
    return {
      allow: true,
      deny_code: null,
      http_status: 200,
      json_rpc_error: null,
      response_data: {},
      decision_meta: {
        policy: "decision-runtime-policy-v2",
        reason_codes: ["cbm_confirmation_accepted"],
      },
    };
  }

  return {
    allow: true,
    deny_code: null,
    http_status: 200,
    json_rpc_error: null,
    decision_meta: {
      policy: "decision-runtime-policy-v2",
      reason_codes: ["explicit_policy_allow"],
    },
  };
}

module.exports = {
  evaluateDecisionRuntimePolicy,
};
