"use strict";

const assert = require("node:assert/strict");
const schemas = require("../src/schemas/codebase_memory_tools");
const {
  CONFIRMATION_KIND,
  createDestructiveToolConfirmationManager,
} = require("../src/runtime/destructive_tool_confirmation");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");

let nowMs = 1000;
const manager = createDestructiveToolConfirmationManager({ now: () => nowMs, ttlMs: 120000 });
const authA = {
  subject: "operator-a",
  clientId: "client-a",
  audience: "mcp-tools",
  profile: "internal",
  scopes: ["mcp:tools"],
};
const authB = { ...authA, subject: "operator-b" };

assert.equal(CONFIRMATION_KIND, "cbm_delete_project_confirmation");
assert.equal(schemas.CBM_DELETE_PROJECT_INPUT_SCHEMA.properties.confirm.const, true);
assert.equal(schemas.CBM_DELETE_PROJECT_INPUT_SCHEMA.properties.state_handle.minLength > 20, true);

const challenge = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "fixture-project",
  confirm: false,
  stateHandle: "",
  authContext: authA,
});
assert.equal(challenge.allow, false);
assert.equal(challenge.code, "cbm_confirmation_required");
assert.equal(challenge.challenge.kind, CONFIRMATION_KIND);
assert.equal(challenge.challenge.expires_in_ms, 120000);
assert.equal(challenge.challenge.project_sha256.length, 64);
assert.equal(typeof challenge.challenge.state_handle, "string");
assert.ok(challenge.challenge.state_handle.length > 20);

const wrongProject = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "other-project",
  confirm: true,
  stateHandle: challenge.challenge.state_handle,
  authContext: authA,
});
assert.equal(wrongProject.allow, false);
assert.equal(wrongProject.code, "cbm_confirmation_invalid");

const wrongSubject = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "fixture-project",
  confirm: true,
  stateHandle: challenge.challenge.state_handle,
  authContext: authB,
});
assert.equal(wrongSubject.allow, false);
assert.equal(wrongSubject.code, "cbm_confirmation_invalid");

const approved = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "fixture-project",
  confirm: true,
  stateHandle: challenge.challenge.state_handle,
  authContext: authA,
});
assert.equal(approved.allow, true);
assert.equal(approved.code, "cbm_confirmation_accepted");

const replay = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "fixture-project",
  confirm: true,
  stateHandle: challenge.challenge.state_handle,
  authContext: authA,
});
assert.equal(replay.allow, false);
assert.equal(replay.code, "cbm_confirmation_invalid");

const expiring = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "fixture-project",
  authContext: authA,
});
nowMs += 120001;
const expired = manager.evaluate({
  toolName: "cbm_delete_project",
  project: "fixture-project",
  confirm: true,
  stateHandle: expiring.challenge.state_handle,
  authContext: authA,
});
assert.equal(expired.allow, false);
assert.equal(expired.code, "cbm_confirmation_invalid");

function decisionContext(args, authContext = authA) {
  return {
    ok: true,
    reason_codes: [],
    context: {
      version: "decision-runtime-context-v1",
      tool: "cbm_delete_project",
      known_tool: true,
      auth_mode: "oauth21",
      profile: "internal",
      request_id: "request-1",
      arg_summary: {},
      auth_context: authContext,
      destructive_confirmation: {
        project: args.project,
        confirm: args.confirm === true,
        state_handle: args.state_handle || "",
      },
    },
  };
}

const policyManager = createDestructiveToolConfirmationManager({ now: () => 5000, ttlMs: 120000 });
const firstDecision = evaluateDecisionRuntimePolicy({
  decisionContext: decisionContext({ project: "fixture-project" }),
  destructiveConfirmationManager: policyManager,
});
assert.equal(firstDecision.allow, false);
assert.equal(firstDecision.deny_code, "cbm_confirmation_required");
assert.equal(firstDecision.response_data.state_handle.length > 20, true);

const secondDecision = evaluateDecisionRuntimePolicy({
  decisionContext: decisionContext({
    project: "fixture-project",
    confirm: true,
    state_handle: firstDecision.response_data.state_handle,
  }),
  destructiveConfirmationManager: policyManager,
});
assert.equal(secondDecision.allow, true);
assert.equal(secondDecision.decision_meta.reason_codes.includes("cbm_confirmation_accepted"), true);

console.log("smoke_cbm_delete_confirmation ok");
