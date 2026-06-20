"use strict";

function safeDurationMs(timing = {}) {
  const startedAt = typeof timing.startedAt === "number" ? timing.startedAt : null;
  const endedAt = typeof timing.endedAt === "number" ? timing.endedAt : Date.now();
  if (startedAt === null || endedAt < startedAt) {
    return null;
  }
  return endedAt - startedAt;
}

function buildDecisionRuntimeReceipt({ decision, context, timing, route } = {}) {
  const safeDecision = decision && typeof decision === "object" ? decision : {};
  const safeContext = context && typeof context === "object" ? context : {};
  const reasonCodes = Array.isArray(safeDecision.decision_meta?.reason_codes)
    ? safeDecision.decision_meta.reason_codes
    : ["malformed_receipt_input"];

  return {
    version: "decision-runtime-receipt-v1",
    decision_code: safeDecision.allow === true ? "allow" : safeDecision.deny_code || "deny",
    route: typeof route === "string" ? route : "unknown",
    duration_ms: safeDurationMs(timing),
    redacted_context: {
      tool: typeof safeContext.tool === "string" ? safeContext.tool : "unknown",
      known_tool: safeContext.known_tool === true,
      auth_mode: typeof safeContext.auth_mode === "string" ? safeContext.auth_mode : "unknown",
      profile: typeof safeContext.profile === "string" ? safeContext.profile : "unknown",
      request_id: typeof safeContext.request_id === "string" ? safeContext.request_id : null,
      arg_summary: safeContext.arg_summary && typeof safeContext.arg_summary === "object" ? safeContext.arg_summary : null,
    },
    reason_codes: reasonCodes,
  };
}

module.exports = {
  buildDecisionRuntimeReceipt,
};
