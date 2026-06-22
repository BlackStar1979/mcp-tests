"use strict";

function responseClosedReason(res) {
  if (!res) return "missing_response";
  if (res.destroyed === true) return "response_destroyed";
  if (res.writableEnded === true) return "response_writable_ended";
  if (res.closed === true) return "response_closed";
  return null;
}

function abortReason(abortSignal) {
  if (!abortSignal?.aborted) return null;
  const reason = abortSignal.reason;
  if (typeof reason === "string" && reason) return reason;
  if (reason?.message) return reason.message;
  return "request_aborted";
}

function skipResponseWriteIfNeeded({ res, abortSignal, auditLog = () => {}, requestId, phase } = {}) {
  const reason = abortReason(abortSignal) || responseClosedReason(res);
  if (!reason) return false;
  auditLog("response_write_skipped_after_client_disconnect", {
    request_id: requestId,
    reason,
    phase: phase || "unknown",
  });
  return true;
}

module.exports = {
  abortReason,
  responseClosedReason,
  skipResponseWriteIfNeeded,
};
