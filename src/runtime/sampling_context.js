"use strict";

const { sendSessionRequest } = require("./outbound_request_manager");

const DEFAULT_SAMPLING_REQUEST_LIMIT = 3;
const LOW_RISK_MAX_MESSAGES = 1;
const LOW_RISK_MAX_TOKENS = 128;
const HIDDEN_INSTRUCTION_KEYS = ["hiddenInstructions", "systemOverride", "developerOverride"];

class SamplingUnavailableError extends Error {
  constructor(reason) {
    super(`Sampling unavailable: ${reason}`);
    this.name = "SamplingUnavailableError";
    this.reason = reason;
    this.code = "sampling_unavailable";
  }
}

class SamplingPolicyError extends Error {
  constructor(reason) {
    super(`Sampling denied: ${reason}`);
    this.name = "SamplingPolicyError";
    this.reason = reason;
    this.code = "sampling_policy_denied";
  }
}

function hasClientSamplingCapability(session) {
  return Boolean(session?.clientCapabilities?.sampling);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function contentType(content) {
  if (!content || typeof content !== "object") return "text";
  return content.type || "text";
}

function hasHiddenInstructions(params = {}) {
  return HIDDEN_INSTRUCTION_KEYS.some((key) => Object.prototype.hasOwnProperty.call(params, key));
}

function classifySamplingRisk(params = {}) {
  const messages = asArray(params.messages);
  const maxTokens = Number(params.maxTokens || params.max_tokens || 0);
  const reasons = [];
  if (messages.length > LOW_RISK_MAX_MESSAGES) reasons.push("message_count_exceeds_low_risk");
  if (messages.some((message) => message?.role === "system")) reasons.push("system_role_present");
  if (maxTokens > LOW_RISK_MAX_TOKENS) reasons.push("max_tokens_exceeds_low_risk");
  if (messages.some((message) => contentType(message?.content) !== "text")) reasons.push("non_text_content_present");
  if (hasHiddenInstructions(params)) reasons.push("hidden_instructions_present");
  return { risk: reasons.length === 0 ? "low" : "approval_required", reasons };
}

function hasApprovalReceipt(params = {}) {
  const receipt = params.approvalReceipt;
  return Boolean(receipt && typeof receipt === "object" && receipt.status === "approved" && receipt.approved === true);
}

function ensureSamplingBudget(session, limit = DEFAULT_SAMPLING_REQUEST_LIMIT) {
  if (!session) throw new SamplingUnavailableError("missing_session");
  if (!session.samplingBudget) {
    session.samplingBudget = { limit, used: 0 };
  }
  if (session.samplingBudget.used >= session.samplingBudget.limit) {
    throw new SamplingPolicyError("sampling_budget_exhausted");
  }
  session.samplingBudget.used += 1;
  return { ...session.samplingBudget };
}

function createSamplingContext({ session, auditLog = () => {}, requestId, requestLimit = DEFAULT_SAMPLING_REQUEST_LIMIT } = {}) {
  async function requestSampling(params = {}, options = {}) {
    if (!session) {
      throw new SamplingUnavailableError("missing_session");
    }
    if (!hasClientSamplingCapability(session)) {
      throw new SamplingUnavailableError("client_sampling_not_declared");
    }
    const classification = classifySamplingRisk(params);
    if (classification.risk !== "low" && !hasApprovalReceipt(params)) {
      auditLog("sampling_request_denied", {
        request_id: requestId,
        session_id: session.id,
        reason: "approval_required",
        risk_reasons: classification.reasons,
      });
      throw new SamplingPolicyError("approval_required");
    }
    const budget = ensureSamplingBudget(session, options.requestLimit || requestLimit);
    const outbound = sendSessionRequest(session, {
      method: "sampling/createMessage",
      params,
      timeoutMs: options.timeoutMs,
    });
    auditLog("sampling_request_sent", {
      request_id: requestId,
      session_id: session.id,
      rpc_id: outbound.id,
      risk: classification.risk,
      risk_reasons: classification.reasons,
      sampling_budget_used: budget.used,
      sampling_budget_limit: budget.limit,
      approval_receipt_present: hasApprovalReceipt(params),
    });
    return outbound.promise;
  }

  return {
    hasSampling: hasClientSamplingCapability(session),
    requestSampling,
    classifySamplingRisk,
  };
}

function enrichContextWithSampling(context = {}, auditLog = () => {}) {
  const sampling = createSamplingContext({
    session: context.session,
    auditLog,
    requestId: context.requestId,
  });
  return {
    ...context,
    sampling,
    requestSampling: sampling.requestSampling,
  };
}

module.exports = {
  DEFAULT_SAMPLING_REQUEST_LIMIT,
  SamplingPolicyError,
  SamplingUnavailableError,
  classifySamplingRisk,
  createSamplingContext,
  enrichContextWithSampling,
  hasApprovalReceipt,
  hasClientSamplingCapability,
};
