"use strict";

const assert = require("node:assert/strict");
const sampling = require("../SERVER_SAMPLING_POLICY_SPEC.json");
const auth = require("../SERVER_AUTH_SPEC.json");
const eventCatalog = require("../SERVER_EVENT_CATALOG_SPEC.json");

assert.equal(sampling.schema_version, "mcp-tests-sampling-policy-v2");
assert.equal(sampling.status, "deprecated_not_active");
assert.equal(sampling.runtime_enforced, "fail_closed_inactive_boundary");
assert.equal(sampling.active_surviving_route_binding, false);
assert.equal(sampling.connector_visible, false);
assert.equal(sampling.security_boundary.prompt_or_tool_data_forwarded_to_sampling_provider, false);
assert.equal(sampling.security_boundary.approval_receipts_parsed_by_runtime, false);
assert.equal(sampling.runtime_policy.unexpected_client_response_envelopes, "fail_closed_server_initiated_requests_not_active");
assert.equal(auth.sampling_user_approval_policy.sampling_policy_spec_ref, "SERVER_SAMPLING_POLICY_SPEC.json");
assert.equal(auth.sampling_user_approval_policy.server_initiated_requests_active, false);

const activeEvents = new Set(eventCatalog.events.map((entry) => entry.name));
assert.ok(activeEvents.has("client_response_envelope_rejected"));
assert.equal(activeEvents.has("pending_response_rejected"), false);
assert.equal(activeEvents.has("pending_response_resolved"), false);
assert.equal(activeEvents.has("sampling_request_sent"), false);
assert.equal(activeEvents.has("sampling_request_denied"), false);

console.log("smoke_sampling_user_approval_policy ok");
