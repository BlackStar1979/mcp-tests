"use strict";

const { buildToolStartAudit, buildToolDecisionAudit } = require("./tool_audit_helpers");
const {
  handleCoreFetchToolCall,
  handleCoreSearchToolCall,
} = require("./core_tool_call_handlers");
const { tryHandleOptionalToolCall } = require("./optional_tool_call_handler");
const { handleUnknownToolCall } = require("./unknown_tool_call_handler");
const { logToolCallException } = require("./tool_call_exception_handler");
const { rpcError, rpcResult } = require("./rpc_responses");
const { tryStartTaskAugmentedToolCall } = require("./mcp_tasks_extension");
const { buildDecisionRuntimeContext } = require("./decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("./decision_runtime_policy");
const { buildDecisionRuntimeReceipt } = require("./decision_runtime_receipt");
const { buildCoreToolDescriptors } = require("./core_tool_descriptors");
const { validateToolInput } = require("./tool_input_validator");
const { buildToolInputValidationResult } = require("./tool_input_validation_result");
const { decide: decideRuntimePolicyGate } = require("./policy_enforcement_gate");
const toolsSpec = require("../../SERVER_TOOLS_SPEC.json");
const resourceSpec = require("../../SERVER_RESOURCE_POLICY_SPEC.json");

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
  rateLimiter,
  mrtrExtension,
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
    authResult: context.authResult || {},
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
      ...(decision.response_data || {}),
    });
  }

  const gateDecision = decideRuntimePolicyGate({ toolName: name, profile, toolsSpec, resourceSpec });
  if (gateDecision.allow !== true) {
    auditLog("tool_call_policy_denied", {
      request_id: context.requestId,
      tool: typeof name === "string" ? name : "unknown",
      duration_ms: Date.now() - startedAt,
      decision_code: gateDecision.data.decision_code,
      reason_codes: gateDecision.reasons,
      decision_receipt: decisionReceipt,
      policy_receipt: gateDecision.data,
    });
    return rpcError(id, gateDecision.error.code, gateDecision.error.message, {
      decision_code: gateDecision.data.decision_code,
      reason_codes: gateDecision.reasons,
      policy_receipt: gateDecision.data,
    });
  }

  if (rateLimiter && typeof rateLimiter.evaluateToolCall === "function") {
    const rateDecision = rateLimiter.evaluateToolCall({ toolName: name, profile, authMode, requestId: context.requestId });
    if (rateDecision.allow !== true) {
      auditLog("tool_call_rate_limited", {
        request_id: context.requestId,
        tool: typeof name === "string" ? name : "unknown",
        duration_ms: Date.now() - startedAt,
        rate_limit: rateDecision,
      });
      return rpcError(id, -32029, "Rate limit exceeded", {
        decision_code: "rate_limit_exceeded",
        rate_limit: rateDecision,
      });
    }
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
    return buildToolInputValidationResult({ id, errors: inputValidation.errors });
  }

  if (mrtrExtension && typeof mrtrExtension.evaluate === "function") {
    const mrtr = mrtrExtension.evaluate({
      protocolVersion: context.protocolVersion,
      toolName: name,
      args,
      authContext: decisionContext.context?.auth_context || {},
      requirement: decision.mrtr_requirement || null,
      requestState: params.requestState,
      inputResponses: params.inputResponses,
    });
    const mrtrAudit = mrtr && mrtr.audit && typeof mrtr.audit === "object" ? mrtr.audit : {};
    const safeMrtrAudit = {
      request_id: context.requestId,
      tool: typeof name === "string" ? name : "unknown",
      protocol_version: String(context.protocolVersion || ""),
      duration_ms: Date.now() - startedAt,
      reason_code: typeof mrtrAudit.reason_code === "string" ? mrtrAudit.reason_code : undefined,
      state_handle_sha256: typeof mrtrAudit.state_handle_sha256 === "string" ? mrtrAudit.state_handle_sha256 : undefined,
      requirement_sha256: typeof mrtrAudit.requirement_sha256 === "string" ? mrtrAudit.requirement_sha256 : undefined,
      input_request_count: Number.isInteger(mrtrAudit.input_request_count) ? mrtrAudit.input_request_count : undefined,
      expires_at: Number.isFinite(mrtrAudit.expires_at) ? mrtrAudit.expires_at : undefined,
    };

    if (mrtr?.status === "input_required") {
      auditLog("tool_call_mrtr_input_required", safeMrtrAudit);
      return rpcResult(id, mrtr.result);
    }
    if (mrtr?.status === "denied") {
      auditLog("tool_call_mrtr_denied", {
        ...safeMrtrAudit,
        decision_code: String(mrtr.code || "mrtr_denied"),
        reason_code: String(mrtr.reason || safeMrtrAudit.reason_code || "mrtr_denied"),
      });
      return rpcError(id, -32602, "MRTR input retry rejected", {
        decision_code: String(mrtr.code || "mrtr_denied"),
        reason_codes: [String(mrtr.reason || "mrtr_denied")],
      });
    }
    if (mrtr?.status === "retry_ready") {
      auditLog("tool_call_mrtr_retry_accepted", safeMrtrAudit);
    } else if (mrtr?.status !== "not_required") {
      auditLog("tool_call_mrtr_denied", {
        ...safeMrtrAudit,
        decision_code: "mrtr_extension_invalid_outcome",
        reason_code: "mrtr_extension_invalid_outcome",
      });
      return rpcError(id, -32603, "MRTR extension failed closed", {
        decision_code: "mrtr_extension_invalid_outcome",
        reason_codes: ["mrtr_extension_invalid_outcome"],
      });
    }
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
        outputSchema: coreDescriptor?.outputSchema,
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
        outputSchema: coreDescriptor?.outputSchema,
        documentRuntimeContext,
        auditLog,
        getOptionalTool,
      });
    }

    const taskResponse = tryStartTaskAugmentedToolCall({
      id,
      name,
      args,
      context,
      startedAt,
      auditLog,
    });
    if (taskResponse) return taskResponse;

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

    if (optionalResponse) return optionalResponse;

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
