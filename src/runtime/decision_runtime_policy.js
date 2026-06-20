"use strict";

const { PUBLIC_TOOL_NAMES, getToolPolicy } = require("../tool_policy");

function buildJsonRpcError(code, message) {
  return {
    code,
    message,
  };
}


function denyDecision({ code, httpStatus = 403, rpcCode = -32602, message = "Tool call denied", reasons = [] }) {
  return {
    allow: false,
    deny_code: code,
    http_status: httpStatus,
    json_rpc_error: buildJsonRpcError(rpcCode, message),
    decision_meta: {
      policy: "decision-runtime-policy-v2",
      reason_codes: reasons.length ? reasons : [code],
    },
  };
}

function evaluateDecisionRuntimePolicy({ decisionContext } = {}) {
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

  if (toolPolicy.destructive === true) {
    return denyDecision({ code: "destructive_tool_denied", message: `Tool ${toolName} is destructive` });
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
