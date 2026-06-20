"use strict";

const { buildToolStartAudit, buildToolDecisionAudit } = require("./tool_audit_helpers");
const {
  handleCoreFetchToolCall,
  handleCoreSearchToolCall,
} = require("./core_tool_call_handlers");
const { tryHandleOptionalToolCall } = require("./optional_tool_call_handler");
const { handleUnknownToolCall } = require("./unknown_tool_call_handler");
const { logToolCallException } = require("./tool_call_exception_handler");
const { rpcError } = require("./rpc_responses");
const { buildDecisionRuntimeContext } = require("./decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("./decision_runtime_policy");
const { buildDecisionRuntimeReceipt } = require("./decision_runtime_receipt");
const { buildCoreToolDescriptors } = require("./core_tool_descriptors");
const { validateToolInput } = require("./tool_input_validator");

async function handleToolsCall({
  id,
  params,
  context,
  outputMode,
  documentRuntimeContext,
  auditLog,
  authMode,
  profile,
  getOptionalTool,
}) {
  const name = params.name;
  const args = params.arguments || {};
  const startedAt = Date.now();
  const decisionContext = buildDecisionRuntimeContext({
    toolName: name,
    args,
    authMode,
    profile,
    getOptionalTool,
    requestMeta: {
      requestId: context.requestId,
    },
  });
  const decision = evaluateDecisionRuntimePolicy({ decisionContext });
  const decisionReceipt = buildDecisionRuntimeReceipt({
    decision,
    context: decisionContext.context,
    timing: { startedAt },
    route: "tools/call",
  });

  auditLog("tool_call_decision", buildToolDecisionAudit(decisionReceipt));

  if (decision.allow !== true) {
    if (decision.deny_code === "unknown_tool") {
      return handleUnknownToolCall({
        id,
        name,
        context,
        startedAt,
        auditLog,
        decisionReceipt,
      });
    }

    auditLog("tool_call_error", {
      request_id: context.requestId,
      tool: typeof name === "string" ? name : "unknown",
      duration_ms: Date.now() - startedAt,
      error_kind: decision.deny_code || "decision_runtime_denied",
      decision_receipt: decisionReceipt,
    });

    return rpcError(id, decision.json_rpc_error.code, decision.json_rpc_error.message, {
      decision_code: decision.deny_code,
      reason_codes: decision.decision_meta.reason_codes,
    });
  }

  const coreDescriptor = buildCoreToolDescriptors({
    connectorShapeVersion: "runtime-input-validation",
    outputMode,
    maxFetchTextChars: 2500,
  }).find((tool) => tool.name === name);
  const optionalTool = getOptionalTool(name);
  const inputSchema = coreDescriptor?.inputSchema || optionalTool?.descriptor?.inputSchema;
  const inputValidation = validateToolInput(name, args, inputSchema);
  if (!inputValidation.ok) {
    auditLog("tool_call_error", {
      request_id: context.requestId,
      tool: typeof name === "string" ? name : "unknown",
      duration_ms: Date.now() - startedAt,
      error_kind: "invalid_tool_arguments",
      validation_errors: inputValidation.errors,
    });
    return rpcError(id, -32602, "Invalid tool arguments", {
      decision_code: "invalid_tool_arguments",
      validation_errors: inputValidation.errors,
    });
  }

  auditLog("tool_call_start", buildToolStartAudit(getOptionalTool, context, id, name, args));

  try {
    if (name === "search") {
      return handleCoreSearchToolCall({
        id,
        context,
        args,
        startedAt,
        outputMode,
        documentRuntimeContext,
        auditLog,
        getOptionalTool,
      });
    }

    if (name === "fetch") {
      return handleCoreFetchToolCall({
        id,
        context,
        args,
        startedAt,
        outputMode,
        documentRuntimeContext,
        auditLog,
        getOptionalTool,
      });
    }

    const optionalResponse = await tryHandleOptionalToolCall({
      id,
      name,
      args,
      context,
      startedAt,
      outputMode,
      getOptionalTool,
      auditLog,
    });

    if (optionalResponse) {
      return optionalResponse;
    }

    return handleUnknownToolCall({
      id,
      name,
      context,
      startedAt,
      auditLog,
    });
  } catch (error) {
    logToolCallException({
      name,
      context,
      startedAt,
      error,
      auditLog,
    });

    throw error;
  }
}

module.exports = {
  handleToolsCall,
};
