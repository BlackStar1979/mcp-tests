"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
function read(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
const root=read("SERVER_SPEC.json");
const res=read("SERVER_RESOURCE_POLICY_SPEC.json");
const authz=read("SERVER_AUTHZ_DECISION_SPEC.json");
const profiles=read("SERVER_PROFILES_SPEC.json");
const tools=read("SERVER_TOOLS_SPEC.json");
const pub=read("profiles/public.json");
const tests=read("profiles/tests.json");
const { validateProfileObject } = require("../src/profile_schema_validator");
assert.equal(res.schema_version,"mcp-tests-server-resource-policy-spec-v1");
assert.equal(res.mandatory_rules.no_cli_extension,true);
assert.equal(res.mandatory_rules.database_raw_query_tools_forbidden,true);
assert.ok(res.resource_classes.filesystem_public.public_surface_allowed);
assert.equal(res.resource_classes.memory_context_scoped.public_surface_allowed,false);
assert.equal(root.spec_refs.resource_policy,"SERVER_RESOURCE_POLICY_SPEC.json");
assert.equal(authz.resource_policy_ref,"SERVER_RESOURCE_POLICY_SPEC.json");
assert.equal(profiles.server_profiles.resource_policy_ref,"SERVER_RESOURCE_POLICY_SPEC.json");
assert.equal(tools.resource_policy_ref,"SERVER_RESOURCE_POLICY_SPEC.json");
const catalog=tools.tool_catalog;
const names=Object.values(tools.surface_classes).flatMap((surface)=>surface.tools || []);
assert.equal(Object.keys(catalog).length,names.length);
for(const name of names){
  const item=catalog[name];
  assert.equal(item.name,name);
  assert.ok(res.resource_classes[item.resource_class],name+" resource class");
  assert.ok(res.operation_classes[item.operation_class],name+" operation class");
  assert.ok(item.resource_policy_refs.includes("SERVER_RESOURCE_POLICY_SPEC.json"));
}
for(const surf of Object.values(pub.surfaces)){
  assert.ok(surf.allowed_resource_policy_refs.includes("public_index"));
  assert.ok(surf.allowed_resource_policy_refs.includes("filesystem_public"));
  assert.ok(!surf.allowed_resource_policy_refs.includes("memory_context_scoped"));
}
assert.ok(tests.surfaces.authenticated.allowed_resource_policy_refs.includes("memory_context_scoped"));
const bad=JSON.parse(JSON.stringify(pub));
bad.surfaces.public.allowed_resource_policy_refs.push("memory_context_scoped");
const result=validateProfileObject(bad,{expectedName:"public",profilePath:"profiles/public.json"});
assert.equal(result.ok,false);
assert.ok(result.errors.join(";").includes("non-public resource policy ref"));
assert.equal(Boolean(root.cli?.parameters?.["--resource-policy"]),false);
console.log("smoke_resource_policy_spec ok");
