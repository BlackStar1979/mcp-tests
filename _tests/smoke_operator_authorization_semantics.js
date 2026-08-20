"use strict";

const assert = require("node:assert/strict");
const { getToolPolicy } = require("../src/tool_policy");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");
const { resolveConsentRequirement } = require("../src/runtime/consent_runtime_policy");
const { resetDefaultDestructiveToolConfirmationManagerForTests } = require("../src/runtime/destructive_tool_confirmation");

function decisionContext(toolName, { scopes = ["mcp:tools"], confirmation = null } = {}) {
  return {
    ok: true,
    reason_codes: [],
    context: {
      version: "decision-runtime-context-v1",
      tool: toolName,
      known_tool: true,
      auth_mode: "oauth21",
      profile: "internal",
      request_id: `authz-${toolName}`,
      arg_summary: {
        arg_key_count: 0,
        arg_keys_sha256: "",
        arg_shape_sha256: "",
        arg_shape_bytes: 2,
        flags: {},
      },
      auth_context: {
        subject: "operator",
        clientId: "operator-authz-test-client",
        audience: "mcp-tools",
        profile: "internal",
        scopes,
      },
      ...(confirmation ? { destructive_confirmation: confirmation } : {}),
    },
  };
}

(function normalBoundedProcessCallsUseStandingOauthAuthorization() {
  for (const toolName of ["run_process", "process_start", "process_cancel"]) {
    const consent = resolveConsentRequirement({ toolName, toolPolicy: getToolPolicy(toolName) });
    assert.deepEqual(consent, { required: false, ok: true }, `${toolName} must not require fresh MRTR consent`);

    const decision = evaluateDecisionRuntimePolicy({ decisionContext: decisionContext(toolName) });
    assert.equal(decision.allow, true, `${toolName} must be allowed for authenticated internal mcp:tools clients`);
    assert.equal(decision.mrtr_requirement, undefined, `${toolName} must not emit an MRTR requirement`);
  }
})();

(function boundedWorkspaceWriteIsNotBlanketDeniedByDestructiveMetadata() {
  const decision = evaluateDecisionRuntimePolicy({ decisionContext: decisionContext("write_file") });
  assert.equal(decision.allow, true, "write_file must be authorized by OAuth/policy rather than blanket destructive deny");
  assert.equal(decision.deny_code, null);
})();

(function explicitMrtrClassificationStillBuildsTheExistingHumanApprovalRequirement() {
  const toolPolicy = {
    ...getToolPolicy("run_process"),
    consent_mode: "mrtr_human_approval",
  };
  const first = resolveConsentRequirement({ toolName: "run_process", toolPolicy });
  const second = resolveConsentRequirement({ toolName: "run_process", toolPolicy });
  assert.equal(first.required, true);
  assert.equal(first.ok, true);
  assert.equal(first.requirement.kind, "human_consent_v1");
  assert.equal(first.requirement.consent.tool_name, "run_process");
  assert.equal(first.requirement.consent.resource_class, "process_execution_bounded");
  assert.equal(first.requirement.consent.operation_class, "execute");
  assert.equal(first.requirement.consent.risk_class, "high");
  assert.deepEqual(first.requirement.inputRequests.human_approval.params.requestedSchema, {
    type: "object",
    properties: { confirmed: { type: "boolean" } },
    required: ["confirmed"],
    additionalProperties: false,
  });
  assert.deepEqual(second, first, "explicit MRTR requirements must remain deterministic");
})();

(function toolOwnedDeletionConfirmationRemainsProtected() {
  resetDefaultDestructiveToolConfirmationManagerForTests({ now: () => 1000 });
  const first = evaluateDecisionRuntimePolicy({
    decisionContext: decisionContext("cbm_delete_project", {
      confirmation: { project: "authorization-test-project", confirm: false, state_handle: "" },
    }),
  });
  assert.equal(first.allow, false);
  assert.equal(first.deny_code, "cbm_confirmation_required");
  assert.equal(typeof first.response_data?.state_handle, "string");
})();

(function oauthScopeBoundaryRemainsFailClosed() {
  const decision = evaluateDecisionRuntimePolicy({
    decisionContext: decisionContext("run_process", { scopes: [] }),
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.deny_code, "insufficient_scope");
  assert.deepEqual(decision.response_data.required_scopes, ["mcp:tools"]);
})();

console.log("smoke_operator_authorization_semantics ok");
