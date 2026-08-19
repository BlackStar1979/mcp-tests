"use strict";

const assert = require("node:assert/strict");
const { getToolPolicy } = require("../src/tool_policy");
const {
  CONSENT_REQUIREMENT_KIND,
  CONSENT_RESPONSE_KEY,
  resolveConsentRequirement,
  verifyConsentResponse,
} = require("../src/runtime/consent_runtime_policy");

function classify(toolName, overrides = {}) {
  return resolveConsentRequirement({
    toolName,
    toolPolicy: getToolPolicy(toolName),
    ...overrides,
  });
}

(function selectedProcessToolsProduceDeterministicHumanConsentRequirements() {
  const expectations = {
    run_process: ["process_execution_bounded", "execute"],
    process_start: ["process_execution_bounded", "execute"],
    process_cancel: ["process_job_control", "cancel"],
  };

  for (const [toolName, [resourceClass, operationClass]] of Object.entries(expectations)) {
    const result = classify(toolName);
    assert.equal(result.required, true, toolName);
    assert.equal(result.ok, true, toolName);
    assert.equal(result.requirement.kind, CONSENT_REQUIREMENT_KIND, toolName);
    assert.equal(result.requirement.kind, "human_consent_v1", toolName);
    assert.equal(result.requirement.consent.response_key, CONSENT_RESPONSE_KEY, toolName);
    assert.equal(result.requirement.consent.response_key, "human_approval", toolName);
    assert.equal(result.requirement.consent.tool_name, toolName, toolName);
    assert.equal(result.requirement.consent.resource_class, resourceClass, toolName);
    assert.equal(result.requirement.consent.operation_class, operationClass, toolName);
    assert.equal(result.requirement.consent.risk_class, "high", toolName);
    assert.deepEqual(result.requirement.consent.scope_delta, [], toolName);
    assert.equal(result.requirement.consent.external_origin, null, toolName);
    assert.equal(result.requirement.inputRequests.human_approval.method, "elicitation/create", toolName);
    assert.equal(result.requirement.inputRequests.human_approval.params.mode, "form", toolName);
    assert.deepEqual(result.requirement.inputRequests.human_approval.params.requestedSchema, {
      type: "object",
      properties: { confirmed: { type: "boolean" } },
      required: ["confirmed"],
      additionalProperties: false,
    }, toolName);
    assert.match(result.requirement.inputRequests.human_approval.params.message, new RegExp(`Human approval required for ${toolName}`));
    assert.ok(result.requirement.inputRequests.human_approval.params.message.includes(`resource=${resourceClass}`), toolName);
    assert.ok(result.requirement.inputRequests.human_approval.params.message.includes(`operation=${operationClass}`), toolName);
    assert.ok(result.requirement.inputRequests.human_approval.params.message.includes("risk=high"), toolName);
    assert.ok(result.requirement.inputRequests.human_approval.params.message.includes("scope_delta=none"), toolName);
    assert.ok(result.requirement.inputRequests.human_approval.params.message.includes("external_origin=none"), toolName);
    assert.ok(result.requirement.inputRequests.human_approval.params.message.endsWith("Approve this exact call?"), toolName);
    assert.deepEqual(classify(toolName), result, `${toolName} requirement must be deterministic`);
  }
})();

(function readOnlyToolsDoNotRequireConsent() {
  assert.deepEqual(classify("process_status"), { required: false, ok: true });
  assert.deepEqual(classify("search"), { required: false, ok: true });
})();

(function missingCatalogTruthForConsentToolFailsClosed() {
  const result = classify("run_process", { toolCatalog: {} });
  assert.equal(result.required, true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "consent_tool_catalog_entry_missing");
  assert.equal(result.requirement, undefined);
})();

(function inconsistentRuntimePolicyForConsentToolFailsClosed() {
  const result = resolveConsentRequirement({
    toolName: "process_start",
    toolPolicy: { ...getToolPolicy("process_start"), destructive: false },
  });
  assert.equal(result.required, true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "consent_tool_policy_invalid");
})();

(function semanticConsentVerifierAcceptsOnlyExactHumanApproval() {
  const requirement = classify("run_process").requirement;
  const mrtrAudit = {
    state_handle_sha256: "state-handle-sha256",
    requirement_sha256: "requirement-sha256",
  };
  const accepted = verifyConsentResponse({
    requirement,
    inputResponses: {
      human_approval: { action: "accept", content: { confirmed: true } },
    },
    mrtrAudit,
  });
  assert.equal(accepted.status, "accepted");
  assert.deepEqual(accepted.receipt, {
    version: "human-consent-receipt-v1",
    outcome: "accepted",
    tool_name: "run_process",
    resource_class: "process_execution_bounded",
    operation_class: "execute",
    risk_class: "high",
    scope_delta: [],
    external_origin: null,
    state_handle_sha256: "state-handle-sha256",
    requirement_sha256: "requirement-sha256",
    binding_verified: true,
  });
  assert.deepEqual(Object.keys(accepted.receipt).sort(), [
    "binding_verified",
    "external_origin",
    "operation_class",
    "outcome",
    "requirement_sha256",
    "resource_class",
    "risk_class",
    "scope_delta",
    "state_handle_sha256",
    "tool_name",
    "version",
  ]);
})();

(function semanticConsentVerifierFailsClosedForAllNonApprovalShapes() {
  const requirement = classify("run_process").requirement;
  const mrtrAudit = {
    state_handle_sha256: "state-handle-sha256",
    requirement_sha256: "requirement-sha256",
  };
  const cases = [
    ["confirmed_false", { human_approval: { action: "accept", content: { confirmed: false } } }, "consent_not_confirmed"],
    ["missing_content", { human_approval: { action: "accept" } }, "consent_content_invalid"],
    ["missing_confirmed", { human_approval: { action: "accept", content: {} } }, "consent_content_keys_invalid"],
    ["extra_content_key", { human_approval: { action: "accept", content: { confirmed: true, extra: true } } }, "consent_content_keys_invalid"],
    ["decline", { human_approval: { action: "decline" } }, "consent_declined"],
    ["cancel", { human_approval: { action: "cancel" } }, "consent_cancelled"],
    ["wrong_key", { approval: { action: "accept", content: { confirmed: true } } }, "consent_response_keys_invalid"],
    ["missing_key", {}, "consent_response_keys_invalid"],
    ["malformed_response", { human_approval: "accept" }, "consent_response_invalid"],
  ];

  for (const [label, inputResponses, reason] of cases) {
    const result = verifyConsentResponse({ requirement, inputResponses, mrtrAudit });
    assert.equal(result.status, "denied", label);
    assert.equal(result.code, "human_consent_denied", label);
    assert.equal(result.reason, reason, label);
    assert.equal(result.receipt, undefined, label);
  }
})();

(function semanticConsentVerifierRequiresMrtrBindingEvidence() {
  const requirement = classify("run_process").requirement;
  const result = verifyConsentResponse({
    requirement,
    inputResponses: {
      human_approval: { action: "accept", content: { confirmed: true } },
    },
    mrtrAudit: {},
  });
  assert.equal(result.status, "denied");
  assert.equal(result.reason, "consent_binding_evidence_missing");
})();

(function nonConsentRequirementDoesNotInvokeConsentSemantics() {
  assert.deepEqual(verifyConsentResponse({ requirement: null, inputResponses: {}, mrtrAudit: {} }), {
    status: "not_required",
  });
})();

console.log("smoke_human_consent_policy ok");
