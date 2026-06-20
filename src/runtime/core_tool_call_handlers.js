"use strict";

const { rpcResult, toolError } = require("./rpc_responses");
const { fetchDoc, searchDocs } = require("./search_fetch_docs");
const { getToolResultStats } = require("./tool_audit_helpers");
const { toolResult } = require("./tool_result");

function handleCoreSearchToolCall({
  id,
  context,
  args,
  startedAt,
  outputMode,
  documentRuntimeContext,
  auditLog,
  getOptionalTool,
}) {
  const output = {
    results: searchDocs(documentRuntimeContext(), args.query),
  };

  const result = toolResult(outputMode, output);

  auditLog("tool_call_end", {
    request_id: context.requestId,
    tool: "search",
    duration_ms: Date.now() - startedAt,
    is_error: false,
    ...getToolResultStats(getOptionalTool, "search", output),
  });

  return rpcResult(id, result);
}

function handleCoreFetchToolCall({
  id,
  context,
  args,
  startedAt,
  outputMode,
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

  const result = toolResult(outputMode, doc);

  auditLog("tool_call_end", {
    request_id: context.requestId,
    tool: "fetch",
    duration_ms: Date.now() - startedAt,
    is_error: false,
    ...getToolResultStats(getOptionalTool, "fetch", doc),
  });

  return rpcResult(id, result);
}

module.exports = {
  handleCoreFetchToolCall,
  handleCoreSearchToolCall,
};
