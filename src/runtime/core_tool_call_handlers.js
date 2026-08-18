"use strict";

const { rpcResult, toolError } = require("./rpc_responses");
const { fetchDoc, searchDocs } = require("./search_fetch_docs");
const { evaluateToolOutputPolicy } = require("./output_dlp_boundary");
const { getToolResultStats } = require("./tool_audit_helpers");
const { toolResult } = require("./tool_result");
const { resolveToolResultFreshness } = require("./tool_result_freshness");

function enforceCoreOutputPolicy({ id, name, output, outputSchema, context, startedAt, auditLog }) {
  const policy = evaluateToolOutputPolicy({ payload: output, outputSchema });
  if (policy.allow !== true) {
    auditLog("tool_output_policy_denied", {
      request_id: context.requestId,
      tool: name,
      duration_ms: Date.now() - startedAt,
      policy_version: policy.policy_version,
      reason_codes: policy.reason_codes,
      validation_errors: policy.validation_errors,
    });
    return {
      denied: true,
      response: rpcResult(id, toolError("Tool output rejected by server policy.", {
        decision_code: "output_dlp_rejected",
        reason_codes: policy.reason_codes,
      })),
      safeOutput: null,
    };
  }
  if (Number(policy.redaction_stats?.redacted_secret_count || 0) > 0) {
    auditLog("tool_output_redacted", {
      request_id: context.requestId,
      tool: name,
      policy_version: policy.policy_version,
      redacted_secret_count: Number(policy.redaction_stats.redacted_secret_count || 0),
      redacted_field_count: Number(policy.redaction_stats.redacted_field_count || 0),
    });
  }
  return { denied: false, response: null, safeOutput: policy.sanitized_payload };
}

function handleCoreSearchToolCall({
  id,
  context,
  args,
  startedAt,
  outputMode,
  outputSchema,
  documentRuntimeContext,
  auditLog,
  getOptionalTool,
}) {
  const output = {
    results: searchDocs(documentRuntimeContext(), args.query),
  };
  const policy = enforceCoreOutputPolicy({
    id,
    name: "search",
    output,
    outputSchema,
    context,
    startedAt,
    auditLog,
  });
  if (policy.denied) return policy.response;

  const result = toolResult(outputMode, policy.safeOutput, resolveToolResultFreshness("search"));

  auditLog("tool_call_end", {
    request_id: context.requestId,
    tool: "search",
    duration_ms: Date.now() - startedAt,
    is_error: false,
    ...getToolResultStats(getOptionalTool, "search", policy.safeOutput),
  });

  return rpcResult(id, result);
}

function handleCoreFetchToolCall({
  id,
  context,
  args,
  startedAt,
  outputMode,
  outputSchema,
  documentRuntimeContext,
  auditLog,
  getOptionalTool,
}) {
  const doc = fetchDoc(documentRuntimeContext(), args.id);

  if (!doc) {
    const result = toolError("Document not found.", {
      id: String(args.id || ""),
    });

    auditLog("tool_call_end", {
      request_id: context.requestId,
      tool: "fetch",
      duration_ms: Date.now() - startedAt,
      is_error: true,
      error_kind: "document_not_found",
      ...getToolResultStats(getOptionalTool, "fetch", null),
    });

    return rpcResult(id, result);
  }

  const policy = enforceCoreOutputPolicy({
    id,
    name: "fetch",
    output: doc,
    outputSchema,
    context,
    startedAt,
    auditLog,
  });
  if (policy.denied) return policy.response;

  const result = toolResult(outputMode, policy.safeOutput, resolveToolResultFreshness("fetch"));

  auditLog("tool_call_end", {
    request_id: context.requestId,
    tool: "fetch",
    duration_ms: Date.now() - startedAt,
    is_error: false,
    ...getToolResultStats(getOptionalTool, "fetch", policy.safeOutput),
  });

  return rpcResult(id, result);
}

module.exports = {
  handleCoreFetchToolCall,
  handleCoreSearchToolCall,
};
