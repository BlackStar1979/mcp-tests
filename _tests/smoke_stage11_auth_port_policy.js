"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(ROOT, "_workflow", "policies", "stage11_auth_port_policy.json");
const SERVER_PATH = path.join(ROOT, "server.js");
const BOOTSTRAP_RUNTIME_PATH = path.join(ROOT, "src", "runtime", "server_bootstrap_runtime.js");
const AUTH_POLICY_PATH = path.join(ROOT, "src", "auth", "auth_policy.js");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const policy = JSON.parse(read(POLICY_PATH));

assert.equal(policy.policy_name, "stage11_auth_port_policy");
assert.equal(policy.stage, "stage11");
assert.equal(policy.status, "accepted_not_yet_runtime_enforced");
assert.equal(policy.runtime_change_allowed_in_this_step, false);

assert.deepEqual(policy.default_ports, {
  none: 3009,
  access: 3005,
  bearer: 3006,
  oauth: 3007,
  oauth21: 3008,
});

assert.equal(policy.stage11_rules.readiness_first_no_cutover, true);
assert.equal(policy.stage11_rules.do_not_change_tool_surface_with_auth, true);
assert.equal(policy.stage11_rules.keep_3009_as_public_fallback, true);
assert.equal(policy.stage11_rules.do_not_enable_oauth_in_stage11, true);
assert.equal(policy.stage11_rules.do_not_enable_oauth21_in_stage11, true);

assert.equal(policy.reference_only.do_not_mutate_reference_project, true);
assert.equal(policy.reference_only.do_not_copy_secrets, true);

const serverSource = read(SERVER_PATH);
const bootstrapRuntimeSource = read(BOOTSTRAP_RUNTIME_PATH);
assert.match(
  serverSource,
  /runServerBootstrapRuntime\s*\(\s*\{/,
  "server.js must delegate to the Stage 12 bootstrap runtime after Step38X"
);
assert.match(
  bootstrapRuntimeSource,
  /resolveAuthBootstrapConfig\s*\(\s*\{/,
  "server bootstrap runtime must use the Stage 12 bootstrap resolver after integration"
);
assert.match(
  bootstrapRuntimeSource,
  /const\s+port\s*=\s*bootstrapConfig\.port/,
  "server bootstrap runtime port must come from resolved bootstrap config after Step38X"
);

const authPolicySource = read(AUTH_POLICY_PATH);
assert.match(
  authPolicySource,
  /VALID_AUTH_MODES\s*=\s*new\s+Set\s*\(\s*\[\s*["']none["']\s*,\s*["']bearer["']\s*,\s*["']access["']\s*\]\s*\)/s,
  "createAuthPolicy selectable modes must include none,bearer,access after Step 11.6"
);
assert.match(
  authPolicySource,
  /createAccessAuth\s*\(\s*\)/,
  "access mode must return createAccessAuth after Step 11.6"
);
assert.equal(
  /VALID_AUTH_MODES\s*=\s*new\s+Set\s*\([^)]*["']oauth["']/s.test(authPolicySource),
  false,
  "oauth must remain unimplemented/unselectable"
);
assert.equal(
  /VALID_AUTH_MODES\s*=\s*new\s+Set\s*\([^)]*["']oauth21["']/s.test(authPolicySource),
  false,
  "oauth21 must remain unimplemented/unselectable"
);

console.log("smoke_stage11_auth_port_policy ok");
