"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const { resolveAuthBootstrapConfig, AUTH_DEFAULT_PORTS, RETIRED_AUTH_MODES, VALID_AUTH_MODES } = require("../src/runtime/auth_bootstrap_config_resolver");
const { createAuthPolicy } = require("../src/auth/auth_policy");
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }
function throwsRetired(fn, mode) {
  assert.throws(fn, (error) => String(error && error.message || error).includes("Retired") && String(error && error.message || error).includes(mode));
}
assert.deepEqual([...RETIRED_AUTH_MODES].sort(), ["access", "bearer"]);
assert.ok(VALID_AUTH_MODES.has("none"));
assert.ok(VALID_AUTH_MODES.has("oauth"));
assert.ok(VALID_AUTH_MODES.has("oauth21"));
assert.equal(Object.prototype.hasOwnProperty.call(AUTH_DEFAULT_PORTS, "access"), false);
assert.equal(Object.prototype.hasOwnProperty.call(AUTH_DEFAULT_PORTS, "bearer"), false);
for (const mode of ["access", "bearer"]) {
  throwsRetired(() => resolveAuthBootstrapConfig({ argv: ["--auth", mode], env: {} }), mode);
  throwsRetired(() => resolveAuthBootstrapConfig({ argv: [], env: { MCP_TEST_AUTH_MODE: mode } }), mode);
  throwsRetired(() => createAuthPolicy({ mode }), mode);
}
for (const mode of ["none", "oauth", "oauth21"]) {
  const cfg = resolveAuthBootstrapConfig({ argv: ["--auth", mode], env: {} });
  assert.equal(cfg.authMode, mode);
}
const topology = readJson("SERVER_RUNTIME_TOPOLOGY_SPEC.json");
const retired = JSON.stringify(topology.retired_or_non_target_runtimes || topology);
assert.ok(retired.includes("access"));
assert.ok(retired.includes("bearer"));
const authSpec = readJson("SERVER_AUTH_SPEC.json");
assert.equal(authSpec.sessionless_ready_review.status, "sessionless_ready_reviewed");
console.log("smoke_legacy_retired_auth_negative_controls ok");
