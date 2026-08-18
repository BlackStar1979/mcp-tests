"use strict";

const assert = require("node:assert/strict");
const { createMrtrExtension } = require("../src/runtime/mrtr_extension");
const { createStateHandleStore } = require("../src/runtime/state_handle_prototype");

const MODERN = "2026-07-28";
const LEGACY = "2025-11-25";
const SECRET = "raw-secret-must-never-enter-mrtr-state";

function auth(overrides = {}) {
  return {
    subject: "operator-1",
    clientId: "client-1",
    audience: "mcp-tools",
    profile: "internal",
    scopes: ["mcp:tools"],
    ...overrides,
  };
}

function requirement(message = "Approve the exact process mutation") {
  return {
    kind: "human_consent",
    risk_class: "process_mutation",
    inputRequests: {
      approval: {
        method: "elicitation/create",
        params: {
          mode: "form",
          message,
          requestedSchema: {
            type: "object",
            properties: { confirmed: { type: "boolean" } },
            required: ["confirmed"],
            additionalProperties: false,
          },
        },
      },
    },
  };
}

function argsA() {
  return {
    command: "node",
    env: { TOKEN: SECRET, MODE: "check" },
    nested: { z: 2, a: [true, "x"] },
  };
}

function argsSameDifferentKeyOrder() {
  return {
    nested: { a: [true, "x"], z: 2 },
    env: { MODE: "check", TOKEN: SECRET },
    command: "node",
  };
}

function acceptedResponse() {
  return {
    approval: {
      action: "accept",
      content: { confirmed: true },
    },
  };
}

function firstRound(mrtr, overrides = {}) {
  return mrtr.evaluate({
    protocolVersion: MODERN,
    toolName: "process_start",
    args: argsA(),
    authContext: auth(),
    requirement: requirement(),
    ...overrides,
  });
}

(function noRequirementIsNoOpAcrossProtocolEras() {
  const mrtr = createMrtrExtension();
  assert.deepEqual(mrtr.evaluate({ protocolVersion: MODERN, toolName: "search", args: {}, authContext: auth() }), {
    status: "not_required",
  });
  assert.deepEqual(mrtr.evaluate({ protocolVersion: LEGACY, toolName: "search", args: {}, authContext: auth() }), {
    status: "not_required",
  });
})();

(function modernInitialRoundIsBoundedAndOpaque() {
  const mrtr = createMrtrExtension();
  const first = firstRound(mrtr);
  assert.equal(first.status, "input_required");
  assert.equal(first.result.resultType, "input_required");
  assert.deepEqual(Object.keys(first.result.inputRequests), ["approval"]);
  assert.equal(first.result.inputRequests.approval.method, "elicitation/create");
  assert.equal(first.result.inputRequests.approval.params.mode, "form");
  assert.equal(typeof first.result.requestState, "string");
  assert.ok(first.result.requestState.length >= 24);
  assert.equal(first.result.requestState.includes("process_start"), false);
  assert.equal(first.result.requestState.includes(SECRET), false);
  assert.equal(JSON.stringify(first.audit).includes(first.result.requestState), false, "audit must not contain raw state");
  assert.equal(JSON.stringify(first.audit).includes(SECRET), false, "audit must not contain raw args");
  assert.equal(first.audit.input_request_count, 1);
  assert.equal(typeof first.audit.state_handle_sha256, "string");
  assert.equal(typeof first.audit.requirement_sha256, "string");
})();

(function persistedMrtrStateContainsDigestsAndSafeKeysOnly() {
  const base = createStateHandleStore();
  let capturedPayload = null;
  const store = {
    create(options) {
      capturedPayload = options.payload;
      return base.create(options);
    },
    read: base.read,
    destroy: base.destroy,
    size: base.size,
  };
  const mrtr = createMrtrExtension({ store });
  firstRound(mrtr);
  assert.deepEqual(Object.keys(capturedPayload).sort(), [
    "arguments_sha256",
    "input_request_keys",
    "requirement_sha256",
    "scope_sha256",
    "state_version",
    "tool_name",
  ]);
  assert.equal(JSON.stringify(capturedPayload).includes(SECRET), false);
  assert.equal(Object.hasOwn(capturedPayload, "arguments"), false);
  assert.equal(Object.hasOwn(capturedPayload, "inputResponses"), false);
})();

(function canonicalArgumentsAllowSemanticKeyReorderingAndThenRejectReplay() {
  const mrtr = createMrtrExtension();
  const first = firstRound(mrtr);
  const retry = firstRound(mrtr, {
    args: argsSameDifferentKeyOrder(),
    requestState: first.result.requestState,
    inputResponses: acceptedResponse(),
  });
  assert.equal(retry.status, "retry_ready");
  assert.deepEqual(retry.inputResponses, acceptedResponse());
  assert.equal(retry.audit.reason_code, "mrtr_retry_accepted");

  const replay = firstRound(mrtr, {
    requestState: first.result.requestState,
    inputResponses: acceptedResponse(),
  });
  assert.equal(replay.status, "denied");
  assert.equal(replay.code, "mrtr_state_invalid");
  assert.equal(replay.reason, "state_handle_revoked");
})();

(function changedToolArgumentsScopeRequirementAndOwnerFailClosed() {
  const cases = [
    {
      label: "tool",
      mutate(call) { call.toolName = "process_cancel"; },
      reason: "mrtr_request_binding_mismatch",
    },
    {
      label: "arguments",
      mutate(call) { call.args = { ...argsA(), command: "python" }; },
      reason: "mrtr_request_binding_mismatch",
    },
    {
      label: "scope",
      mutate(call) { call.authContext = auth({ scopes: ["mcp:tools", "mcp:operator"] }); },
      reason: "mrtr_request_binding_mismatch",
    },
    {
      label: "requirement",
      mutate(call) { call.requirement = requirement("Different approval text"); },
      reason: "mrtr_request_binding_mismatch",
    },
    {
      label: "owner",
      mutate(call) { call.authContext = auth({ subject: "operator-2" }); },
      reason: "state_handle_unauthorized",
    },
  ];

  for (const testCase of cases) {
    const mrtr = createMrtrExtension();
    const first = firstRound(mrtr);
    const call = {
      protocolVersion: MODERN,
      toolName: "process_start",
      args: argsA(),
      authContext: auth(),
      requirement: requirement(),
      requestState: first.result.requestState,
      inputResponses: acceptedResponse(),
    };
    testCase.mutate(call);
    const result = mrtr.evaluate(call);
    assert.equal(result.status, "denied", testCase.label);
    assert.equal(result.reason, testCase.reason, testCase.label);

    const legitimateRetry = firstRound(mrtr, {
      requestState: first.result.requestState,
      inputResponses: acceptedResponse(),
    });
    if (testCase.label === "owner") {
      assert.equal(legitimateRetry.status, "retry_ready", "cross-owner attempt must not revoke another owner's state");
    } else {
      assert.equal(legitimateRetry.status, "denied", `${testCase.label} mismatch must consume the state`);
      assert.equal(legitimateRetry.reason, "state_handle_revoked", testCase.label);
    }
  }
})();

(function expiryFailsClosed() {
  let clock = 1_000;
  const mrtr = createMrtrExtension({ now: () => clock, ttlMs: 1_000 });
  const first = firstRound(mrtr);
  clock = 2_001;
  const expired = firstRound(mrtr, {
    requestState: first.result.requestState,
    inputResponses: acceptedResponse(),
  });
  assert.equal(expired.status, "denied");
  assert.equal(expired.reason, "state_handle_expired");
})();

(function pairedRetryFieldsAndExactResponseKeysAreRequired() {
  const mrtr = createMrtrExtension();
  const first = firstRound(mrtr);
  const missingResponses = firstRound(mrtr, { requestState: first.result.requestState });
  assert.equal(missingResponses.status, "denied");
  assert.equal(missingResponses.reason, "mrtr_retry_fields_must_be_paired");

  const second = firstRound(mrtr);
  const extraKey = firstRound(mrtr, {
    requestState: second.result.requestState,
    inputResponses: { ...acceptedResponse(), unexpected: { action: "cancel" } },
  });
  assert.equal(extraKey.status, "denied");
  assert.equal(extraKey.reason, "mrtr_input_response_keys_mismatch");

  const consumed = firstRound(mrtr, {
    requestState: second.result.requestState,
    inputResponses: acceptedResponse(),
  });
  assert.equal(consumed.status, "denied");
  assert.equal(consumed.reason, "state_handle_revoked");
})();

(function elicitationResponseWireShapeIsValidatedWithoutInterpretingConsent() {
  const mrtr = createMrtrExtension();
  const first = firstRound(mrtr);
  const declined = firstRound(mrtr, {
    requestState: first.result.requestState,
    inputResponses: { approval: { action: "decline" } },
  });
  assert.equal(declined.status, "retry_ready");
  assert.equal(declined.inputResponses.approval.action, "decline");

  const second = firstRound(mrtr);
  const invalidAction = firstRound(mrtr, {
    requestState: second.result.requestState,
    inputResponses: { approval: { action: "approve" } },
  });
  assert.equal(invalidAction.status, "denied");
  assert.equal(invalidAction.reason, "mrtr_input_response_invalid");
})();

(function unsupportedInputRequestAndLegacyRequirementFailClosed() {
  const mrtr = createMrtrExtension();
  const unsupported = firstRound(mrtr, {
    requirement: {
      inputRequests: {
        approval: { method: "sampling/createMessage", params: {} },
      },
    },
  });
  assert.equal(unsupported.status, "denied");
  assert.equal(unsupported.reason, "mrtr_input_request_method_not_supported");

  const legacy = firstRound(mrtr, { protocolVersion: LEGACY });
  assert.equal(legacy.status, "denied");
  assert.equal(legacy.reason, "mrtr_protocol_not_supported");
})();

console.log("smoke_mrtr_extension ok");
