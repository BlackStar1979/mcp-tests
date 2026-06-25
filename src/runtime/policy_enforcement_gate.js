"use strict";

const ERROR_SHAPE = Object.freeze({ code: -32602, message: "Tool call denied by runtime policy" });

function once(items) {
  const out = [];
  for (const item of items) if (!out.includes(item)) out.push(item);
  return out;
}

function check(input = {}) {
  const catalog = input.toolsSpec && input.toolsSpec.tool_catalog || {};
  const resources = input.resourceSpec && input.resourceSpec.resource_classes || {};
  const operations = input.resourceSpec && input.resourceSpec.operation_classes || {};
  const entry = catalog[input.toolName] || null;
  const reasons = [];
  if (!entry) return { entry, reasons: ["missing_catalog_entry"] };
  const r = entry.resource_class;
  const o = entry.operation_class;
  const rs = r ? resources[r] : null;
  const os = o ? operations[o] : null;
  if (!r) reasons.push("resource_class_missing");
  else if (!rs) reasons.push("resource_class_unknown");
  if (!o) reasons.push("operation_class_missing");
  else if (!os) reasons.push("operation_class_unknown");
  if (rs && o) {
    const allowed = Array.isArray(rs.allowed_operations) ? rs.allowed_operations : [];
    if (!allowed.includes(o)) reasons.push("operation_not_allowed_for_resource_class");
  }
  return { entry, reasons: once(reasons) };
}

function decide(input = {}) {
  const result = check(input);
  const ok = result.reasons.length === 0;
  return Object.freeze({
    allow: ok,
    error: ok ? null : ERROR_SHAPE,
    reasons: result.reasons,
    event: ok ? null : "tool_call_policy_denied",
    data: Object.freeze({
      decision_code: ok ? null : "runtime_policy_denied",
      reason_codes: result.reasons,
      raw_arguments_included: false,
    }),
  });
}

module.exports = { decide, check, ERROR_SHAPE };
