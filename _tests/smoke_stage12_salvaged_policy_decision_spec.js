"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));

const root = read("SERVER_SPEC.json");
const auth = read("SERVER_AUTH_SPEC.json");
const profiles = read("SERVER_PROFILES_SPEC.json");
const tools = read("SERVER_TOOLS_SPEC.json");
const decision = read("SERVER_AUTHZ_DECISION_SPEC.json");

assert.equal(decision.schema_version, "mcp-tests-server-authz-decision-spec-v1");
assert.equal(decision.cross_category_rules.no_cli_extension, true);
assert.equal(decision.decision_model.default_decision, "deny");
assert.deepEqual(decision.decision_model.decision_values, ["allow", "deny"]);
assert.ok(decision.reason_codes.includes("DENY_DEFAULT"));
assert.ok(decision.reason_codes.includes("DENY_UNKNOWN_TOOL"));
assert.ok(decision.rule_precedence.includes("default_deny"));
assert.equal(decision.interface_contract.fail_closed_semantics.default_decision, "deny");

assert.equal(root.spec_refs.policy_decision, "SERVER_AUTHZ_DECISION_SPEC.json");
assert.equal(auth.decision_spec_ref, "SERVER_AUTHZ_DECISION_SPEC.json");
assert.equal(profiles.server_profiles.decision_spec_ref, "SERVER_AUTHZ_DECISION_SPEC.json");
assert.equal(tools.policy_decision_ref, "SERVER_AUTHZ_DECISION_SPEC.json");

assert.equal(Boolean(root.cli?.parameters?.["--decision"]), false);
assert.equal(Boolean(root.cli?.parameters?.["--authz"]), false);
assert.equal(Boolean(root.cli?.parameters?.["--policy-decision"]), false);

console.log("smoke_stage12_salvaged_policy_decision_spec ok");
