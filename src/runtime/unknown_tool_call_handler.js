"use strict";

const { rpcError } = require("./rpc_responses");

function handleUnknownToolCall({
  id,
  name,
  context,
  startedAt,
  auditLog,
  decisionReceipt,
}) {
  auditLog("tool_call_error", {
    request_id: context.requestId,
    tool: typeof name === "string" ? name : "unknown",
    duration_ms: Date.now() - startedAt,
    error_kind: "unknown_tool",
  });

  return rpcError(id, -32602, `Unknown tool: ${name}`);
}

module.exports = {
  handleUnknownToolCall,
};
