"use strict";

const { byteLength, stableSha256 } = require("./runtime_helpers");
const { classifySensitiveMarkers } = require("./audit_arg_markers");

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function summarizeArgs(args) {
  const safeArgs = safeObject(args);
  const keys = Object.keys(safeArgs).sort();
  const shape = {};

  for (const key of keys) {
    const value = safeArgs[key];
    shape[key] = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  }

  const shapeText = JSON.stringify(shape);
  const keyText = keys.join("\n");

  return {
    arg_key_count: keys.length,
    arg_keys_sha256: stableSha256(keyText),
    arg_shape_sha256: stableSha256(shapeText),
    arg_shape_bytes: byteLength(shapeText),
    flags: classifySensitiveMarkers(keys.join(" ")),
  };
}

function buildDecisionRuntimeContext({
  toolName,
  args,
  authMode,
  profile,
  getOptionalTool,
  coreTools = ["search", "fetch"],
  requestMeta = {},
} = {}) {
  const reasonCodes = [];

  if (typeof toolName !== "string" || toolName.trim() === "") {
    reasonCodes.push("missing_tool_name");
  }

  if (typeof authMode !== "string" || authMode.trim() === "") {
    reasonCodes.push("missing_auth_mode");
  }

  if (typeof profile !== "string" || profile.trim() === "") {
    reasonCodes.push("missing_profile");
  }

  const safeToolName = typeof toolName === "string" ? toolName : "unknown";
  const optionalTool =
    typeof getOptionalTool === "function" && typeof toolName === "string"
      ? getOptionalTool(toolName)
      : null;
  const knownTool = coreTools.includes(safeToolName) || Boolean(optionalTool && typeof optionalTool.execute === "function");

  const context = {
    version: "decision-runtime-context-v1",
    tool: safeToolName,
    known_tool: knownTool,
    auth_mode: typeof authMode === "string" ? authMode : "unknown",
    profile: typeof profile === "string" ? profile : "unknown",
    request_id: typeof requestMeta.requestId === "string" ? requestMeta.requestId : null,
    arg_summary: summarizeArgs(args),
  };

  return {
    ok: reasonCodes.length === 0,
    context,
    reason_codes: reasonCodes,
  };
}

module.exports = {
  buildDecisionRuntimeContext,
};
