"use strict";

const TOOL_CANCELLED_ERROR_CODE = -32000;
const TOOL_CANCELLED_DECISION_CODE = "tool_execution_cancelled";

function getAbortSignalReason(abortSignal) {
  if (!abortSignal?.aborted) return null;
  const reason = abortSignal.reason;
  if (typeof reason === "string" && reason) return reason;
  if (reason?.message) return reason.message;
  return "request_aborted";
}

function isAbortLikeError(error) {
  return Boolean(error && (error.name === "AbortError" || error.code === "ABORT_ERR" || error.code === "ERR_ABORTED" || error.cooperativeCancellation === true));
}

function isCooperativeToolCancellation({ error, abortSignal } = {}) {
  if (error?.cooperativeCancellation === true) return true;
  if (!abortSignal?.aborted) return false;
  return isAbortLikeError(error);
}

function buildToolCancellationData({ toolName, abortSignal, error } = {}) {
  return {
    decision_code: TOOL_CANCELLED_DECISION_CODE,
    reason: getAbortSignalReason(abortSignal) || error?.reason || "request_aborted",
    tool: typeof toolName === "string" ? toolName : "unknown",
  };
}

module.exports = {
  TOOL_CANCELLED_DECISION_CODE,
  TOOL_CANCELLED_ERROR_CODE,
  buildToolCancellationData,
  getAbortSignalReason,
  isCooperativeToolCancellation,
};
