"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const sampling = require("../SERVER_SAMPLING_POLICY_SPEC.json");
const auth = require("../SERVER_AUTH_SPEC.json");

assert.equal(fs.existsSync(path.join(ROOT, "src/runtime/session.js")), false);
assert.equal(fs.existsSync(path.join(ROOT, "src/runtime/sampling_context.js")), false);
assert.equal(sampling.status, "deprecated_not_active");
assert.equal(sampling.sampling_role, "unsupported_deprecated_protocol_feature");
assert.equal(sampling.deprecation.protocol_version, "2026-07-28");
assert.equal(sampling.deprecation.classic_sampling_deprecated, true);
assert.equal(sampling.deprecation.new_implementations_should_not_adopt, true);
assert.equal(sampling.deprecation.recommended_replacement, "direct_llm_provider_api");
assert.equal(sampling.runtime_policy.server_initiated_sampling_requests, false);
assert.equal(sampling.runtime_policy.session_sse_sampling_roundtrip, false);
assert.equal(auth.sampling_user_approval_policy.status, "deprecated_not_active");
assert.equal(auth.sampling_user_approval_policy.runtime_implementation_present, false);

console.log("smoke_sampling_capability_gate ok");
