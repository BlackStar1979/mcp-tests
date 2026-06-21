"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const AUTH_POLICY_PATH = path.join(ROOT, "src", "auth", "auth_policy.js");
const BOOTSTRAP_CONFIG_PATH = path.join(ROOT, "src", "runtime", "auth_bootstrap_config_resolver.js");
const SERVER_SPEC_PATH = path.join(ROOT, "SERVER_SPEC.json");
const AUTH_SPEC_PATH = path.join(ROOT, "SERVER_AUTH_SPEC.json");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const serverSpec = JSON.parse(read(SERVER_SPEC_PATH));
const authSpec = JSON.parse(read(AUTH_SPEC_PATH));

assert.deepEqual(serverSpec.auth.runtime_selectable_values, ["none", "oauth21"]);
assert.deepEqual(serverSpec.auth.retired_values, ["access", "bearer"]);
assert.deepEqual(serverSpec.auth_port_policy.default_ports, { none: 3009, oauth21: 3008 });
assert.deepEqual(authSpec.auth_port_policy.default_ports, { none: 3009, oauth21: 3008 });
assert.deepEqual(authSpec.auth_port_policy.retired_default_ports, { access: 3005, bearer: 3006, oauth: 3007 });

const authPolicySource = read(AUTH_POLICY_PATH);
assert.match(authPolicySource, /VALID_AUTH_MODES\s*=\s*new\s+Set\s*\(\s*\[\s*["']none["']\s*,\s*["']oauth["']\s*,\s*["']oauth21["']\s*\]\s*\)/s);
assert.match(authPolicySource, /RETIRED_AUTH_MODES\s*=\s*new\s+Set\s*\(\s*\[\s*["']access["']\s*,\s*["']bearer["']\s*\]\s*\)/s);
assert.doesNotMatch(authPolicySource, /createAccessAuth\s*\(/);

const bootstrapSource = read(BOOTSTRAP_CONFIG_PATH);
assert.match(bootstrapSource, /RETIRED_AUTH_MODES\s*=\s*new\s+Set/);
assert.match(bootstrapSource, /Retired auth mode from/);
assert.doesNotMatch(bootstrapSource, /mcp-tests-access\.romionologic\.dev/);
assert.doesNotMatch(bootstrapSource, /mcp-tests-bearer\.romionologic\.dev/);

console.log("smoke_stage11_auth_port_policy ok");
