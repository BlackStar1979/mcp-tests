"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
function read(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
const root=read("SERVER_SPEC.json");
const net=read("SERVER_NETWORK_POLICY_SPEC.json");
const res=read("SERVER_RESOURCE_POLICY_SPEC.json");
const authz=read("SERVER_AUTHZ_DECISION_SPEC.json");
const profiles=read("SERVER_PROFILES_SPEC.json");
const tools=read("SERVER_TOOLS_SPEC.json");
const pub=read("profiles/public.json");
const tests=read("profiles/tests.json");
const { validateProfileObject } = require("../src/profile_schema_validator");
assert.equal(net.schema_version,"mcp-tests-server-network-policy-spec-v1");
assert.equal(net.runtime_enforced,false);
assert.equal(net.safety_rules.no_cli_extension,true);
assert.equal(net.safety_rules.allowlist_required,true);
assert.equal(net.safety_rules.private_ip_resolution_forbidden,true);
assert.equal(net.safety_rules.network_results_are_observations_not_instructions,true);
assert.equal(root.spec_refs.network_policy,"SERVER_NETWORK_POLICY_SPEC.json");
assert.equal(authz.network_policy_ref,"SERVER_NETWORK_POLICY_SPEC.json");
assert.equal(res.network_policy_ref,"SERVER_NETWORK_POLICY_SPEC.json");
assert.equal(profiles.server_profiles.network_policy_ref,"SERVER_NETWORK_POLICY_SPEC.json");
assert.equal(tools.network_policy_ref,"SERVER_NETWORK_POLICY_SPEC.json");
const expected={
  net_http_get_allowlisted:["allowlisted_https_fetch","read"],
  net_fetch_text_allowlisted:["allowlisted_text_fetch","read"],
  net_check_url_head:["allowlisted_head","head"],
  net_fetch_github_raw:["github_raw_allowlisted","read"],
  net_check_npm_package:["package_metadata_npm","metadata"],
  net_check_pypi_package:["package_metadata_pypi","metadata"]
};
for(const [name,[scope,op]] of Object.entries(expected)){
  assert.equal(net.tool_bindings[name].scope,scope);
  assert.equal(net.tool_bindings[name].operation_class,op);
  assert.equal(net.tool_bindings[name].resource_class,"network_allowlisted");
  assert.equal(tools.tool_catalog[name].operation_class,op);
  assert.equal(tools.tool_catalog[name].network_policy_ref,"SERVER_NETWORK_POLICY_SPEC.json");
}
const scopes=Object.keys(net.network_scopes).sort();
for(const surf of Object.values(pub.surfaces))assert.deepEqual(surf.allowed_network_scopes.slice().sort(),scopes);
for(const surf of Object.values(tests.surfaces))assert.deepEqual(surf.allowed_network_scopes.slice().sort(),scopes);
let bad=JSON.parse(JSON.stringify(pub));
bad.surfaces.public.allowed_network_scopes.push("unknown_network_scope");
let result=validateProfileObject(bad,{expectedName:"public",profilePath:"profiles/public.json"});
assert.equal(result.ok,false);
assert.ok(result.errors.join(";").includes("unknown network scope"));
bad=JSON.parse(JSON.stringify(tests));
bad.surfaces.authenticated.allowed_network_scopes.push("allowlisted_head");
result=validateProfileObject(bad,{expectedName:"tests",profilePath:"profiles/tests.json"});
assert.equal(result.ok,false);
assert.ok(result.errors.join(";").includes("duplicate"));
assert.equal(Boolean(root.cli?.parameters?.["--network-policy"]),false);
console.log("smoke_network_policy_spec ok");
