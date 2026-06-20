"use strict";

const { rpcResult } = require("./rpc_responses");
const { getToolResultStats } = require("./tool_audit_helpers");
const { toolResult } = require("./tool_result");

async function tryHandleOptionalToolCall({
  id,
  name,
  args,
  context,
  startedAt,
  outputMode,
  getOptionalTool,
  auditLog,
}) {
  const optionalTool = getOptionalTool(name);

  if (!(optionalTool && typeof optionalTool.execute === "function")) {
    return null;
  }

  const output = await optionalTool.execute(args, context);
  const result = toolResult(outputMode, output);

  auditLog("tool_call_end", {
    request_id: context.requestId,
    tool: name,
    duration_ms: Date.now() - startedAt,
    is_error: false,
    ...getToolResultStats(getOptionalTool, name, output),
  });

  return rpcResult(id, result);
}

module.exports = {
  tryHandleOptionalToolCall,
};
