"use strict";

const { rpcResult, rpcError, toolError } = require("./rpc_responses");
const { evaluateToolOutputPolicy } = require("./output_dlp_boundary");
const { getToolResultStats } = require("./tool_audit_helpers");
const { toolResult } = require("./tool_result");
const { resolveToolResultFreshness } = require("./tool_result_freshness");
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
    output = await optionalTool.execute(args, {
      ...context,
      auditLog,
    });
  } catch (error) {
    if (isCooperativeToolCancellation({ error, abortSignal: context?.abortSignal })) {
      return buildCancellationResponse({ id, name, context, startedAt, auditLog, error, phase: "execute" });
    }
    throw error;
  }

  if (context?.abortSignal?.aborted) {
    return buildCancellationResponse({ id, name, context, startedAt, auditLog, phase: "after_execute" });
  }

  const outputPolicy = evaluateToolOutputPolicy({
    payload: output,
    outputSchema: optionalTool.descriptor?.outputSchema,
  });
  if (outputPolicy.allow !== true) {
    auditLog("tool_output_policy_denied", {
      request_id: context.requestId,
      tool: name,
      duration_ms: Date.now() - startedAt,
      policy_version: outputPolicy.policy_version,
      reason_codes: outputPolicy.reason_codes,
      validation_errors: outputPolicy.validation_errors,
    });
    return rpcResult(id, toolError("Tool output rejected by server policy.", {
      decision_code: "output_dlp_rejected",
      reason_codes: outputPolicy.reason_codes,
    }));
  }

  const safeOutput = outputPolicy.sanitized_payload;
  if (Number(outputPolicy.redaction_stats?.redacted_secret_count || 0) > 0) {
    auditLog("tool_output_redacted", {
      request_id: context.requestId,
      tool: name,
      policy_version: outputPolicy.policy_version,
      redacted_secret_count: Number(outputPolicy.redaction_stats.redacted_secret_count || 0),
      redacted_field_count: Number(outputPolicy.redaction_stats.redacted_field_count || 0),
    });
  }
  const result = toolResult(outputMode, safeOutput, resolveToolResultFreshness(name));
  const controlledError = safeOutput?.success === false && safeOutput?.error && typeof safeOutput.error === "object";

  auditLog("tool_call_end", {
    request_id: context.requestId,
    tool: name,
    duration_ms: Date.now() - startedAt,
    is_error: Boolean(controlledError),
    error_code: controlledError && typeof safeOutput.error.code === "string"
      ? safeOutput.error.code.slice(0, 100)
      : null,
    ...getToolResultStats(getOptionalTool, name, safeOutput),
  });

  return rpcResult(id, result);
}

module.exports = {
  tryHandleOptionalToolCall,
};
