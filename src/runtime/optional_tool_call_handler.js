"use strict";

const { rpcResult, rpcError } = require("./rpc_responses");
const { getToolResultStats } = require("./tool_audit_helpers");
const { toolResult } = require("./tool_result");
const {
  TOOL_CANCELLED_ERROR_CODE,
  buildToolCancellationData,
  isCooperativeToolCancellation,
} = require("./cooperative_tool_cancellation");

function buildCancellationResponse({ id, name, context, startedAt, auditLog, error, phase }) {
  const cancellation = buildToolCancellationData({ toolName: name, abortSignal: context?.abortSignal, error });
  auditLog("tool_call_cancelled_cooperative", {
    request_id: context?.requestId,
    tool: cancellation.tool,
    duration_ms: Date.now() - startedAt,
    reason: cancellation.reason,
    phase,
  });
  return rpcError(id, TOOL_CANCELLED_ERROR_CODE, "Tool execution cancelled", cancellation);
}

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

  if (context?.abortSignal?.aborted) {
    return buildCancellationResponse({ id, name, context, startedAt, auditLog, phase: "before_execute" });
  }

  let output;
  try {
    output = await optionalTool.execute(args, context);
  } catch (error) {
    if (isCooperativeToolCancellation({ error, abortSignal: context?.abortSignal })) {
      return buildCancellationResponse({ id, name, context, startedAt, auditLog, error, phase: "execute" });
    }
    throw error;
  }

  if (context?.abortSignal?.aborted) {
    return buildCancellationResponse({ id, name, context, startedAt, auditLog, phase: "after_execute" });
  }

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
