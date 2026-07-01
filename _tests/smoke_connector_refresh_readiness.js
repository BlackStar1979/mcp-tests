"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const surface=require("../SERVER_CONNECTOR_SURFACE_SPEC.json");
const tools=require("../SERVER_TOOLS_SPEC.json");
const readiness=fs.readFileSync(path.join(root,"_workflow","CONNECTOR_REFRESH_READINESS.md"),"utf8");
const pub=surface.public_connector;
const repoPublic=tools.surface_classes.public_mcp_tools;
assert.equal(surface.spec_mode,"refresh-readiness-contract-not-live-connector-state");
assert.equal(pub.profile,"public");
assert.equal(pub.auth_mode,"none");
assert.equal(pub.expected_tool_count,13);
assert.equal(repoPublic.tool_count,13);
assert.deepEqual(new Set(pub.expected_tools),new Set(repoPublic.tools));
for(const forbidden of pub.forbidden_tool_names){assert.ok(!pub.expected_tools.includes(forbidden),`forbidden public tool ${forbidden}`);}
for(const category of ["workspace_mutation","process_execution","remote_site_mutation","tool_registry_introspection"]){assert.ok(pub.forbidden_categories.includes(category));}
assert.equal(surface.operator_connector.separate_from_public_connector,true);
assert.equal(surface.operator_connector.must_not_be_labeled_public,true);
assert.equal(surface.authenticated_connector.oauth_before_production_required,true);
assert.equal(surface.live_refresh_readiness.status,"implemented_h9_readiness_contract");
assert.equal(surface.live_refresh_readiness.refresh_is_external_operator_action,true);
assert.equal(surface.live_refresh_readiness.automatic_refresh_forbidden,true);
assert.equal(surface.live_refresh_readiness.explicit_operator_approval_required,true);
assert.equal(surface.live_refresh_readiness.query_token_urls_oauth_ready,false);
assert.equal(surface.live_refresh_readiness.public_connector_must_remain_auth_none,true);
assert.equal(surface.live_refresh_readiness.oauth_resource_server_connector_must_be_separate_from_public_connector,true);
for(const evidence of ["visible_tool_list","auth_mode","public_base_url_or_resource","tool_count","forbidden_tool_absence"]){assert.ok(surface.live_refresh_readiness.post_refresh_evidence_required.includes(evidence));assert.ok(readiness.includes(evidence));}
for(const phrase of ["Do not refresh the live connector automatically","explicit operator approval","Public connector expected tool count: `13`","OAuth/resource-server connector must be separate","Query-token URLs are not OAuth-ready"]){assert.ok(readiness.includes(phrase),`${phrase} missing`);}
console.log("smoke_connector_refresh_readiness ok");
