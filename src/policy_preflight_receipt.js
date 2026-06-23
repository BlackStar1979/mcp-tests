"use strict";

const crypto = require("node:crypto");

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 16);
}

function typeName(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}
function summarizeArgumentShape(args = {}) {
  const safeArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  const keys = Object.keys(safeArgs).sort();
  const shape = {};
  for (const key of keys) {
    const value = safeArgs[key];
    if (Array.isArray(value)) {
      shape[key] = { type: "array", length: value.length, item_types: Array.from(new Set(value.map(typeName))).sort() };
    } else if (value && typeof value === "object") {
      shape[key] = { type: "object", key_count: Object.keys(value).length, keys: Object.keys(value).sort() };
    } else {
      shape[key] = { type: typeName(value) };
    }
  }
  return Object.freeze({
    arg_key_count: keys.length,
    arg_keys: keys,
    arg_shape: shape,
    arg_shape_hash: hashValue(shape),
    raw_values_included: false,
  });
}
function buildPolicyPreflightReceipt({ decision, profileSurface = "", authMode = "", requestId = null, args = {} } = {}) {
  if (!decision || typeof decision !== "object") throw new Error("buildPolicyPreflightReceipt requires decision object.");
  const argSummary = summarizeArgumentShape(args);
  const receipt = {
    schema_version: "stage10-policy-preflight-receipt-v1",
    mode: "dry_run_only",
    tool: typeof decision.tool === "string" ? decision.tool : "unknown",
    profile_surface: String(profileSurface || ""),
    auth_mode: String(authMode || ""),
    request_id: typeof requestId === "string" ? requestId : null,
    would_allow: decision.would_allow === true,
    would_deny: decision.would_deny === true,
    reason_codes: Array.isArray(decision.reason_codes) ? decision.reason_codes.slice().sort() : [],
    resource_class: decision.resource_class || null,
    operation_class: decision.operation_class || null,
    surface_class: decision.surface_class || null,
    mutation: decision.mutation === true,
    audit_required: decision.audit_required === true,
    arg_summary: argSummary,
    arg_hash: argSummary.arg_shape_hash,
    raw_arguments_included: false,
    runtime_audit_event_emitted: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    connector_visible_schema_changed: false,
  };
  return Object.freeze({ ...receipt, receipt_hash: hashValue(receipt) });
}
function buildPolicyPreflightReceipts({ evaluation, profileSurface = "", authMode = "", argsByTool = {} } = {}) {
  if (!evaluation || !Array.isArray(evaluation.decisions)) throw new Error("buildPolicyPreflightReceipts requires evaluation decisions.");
  const receipts = evaluation.decisions.map((decision) => buildPolicyPreflightReceipt({
    decision,
    profileSurface,
    authMode,
    args: argsByTool[decision.tool] || {},
  }));
  return Object.freeze({
    schema_version: "stage10-policy-preflight-receipt-set-v1",
    mode: "dry_run_only",
    receipt_count: receipts.length,
    denied_receipt_count: receipts.filter((receipt) => receipt.would_deny).length,
    receipts,
    raw_arguments_included: false,
    runtime_audit_event_emitted: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
  });
}

module.exports = {
  buildPolicyPreflightReceipt,
  buildPolicyPreflightReceipts,
  hashValue,
  stableJson,
  summarizeArgumentShape,
};
