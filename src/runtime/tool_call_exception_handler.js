"use strict";

function logToolCallException({
  name,
  context,
  startedAt,
  error,
  auditLog,
}) {
  auditLog("tool_call_error", {
    request_id: context.requestId,
    tool: typeof name === "string" ? name : "unknown",
    duration_ms: Date.now() - startedAt,
    error_kind: "exception",
    error_message: error?.message || String(error),
  });
}

module.exports = {
  logToolCallException,
};
