"use strict";
const assert=require("node:assert/strict");
const spec=require("../SERVER_AUTH_SPEC.json");
const policy=spec.pkce_client_flow_policy;
assert.equal(policy.status,"implemented_h5_policy");
assert.equal(policy.authorization_server_implemented_by_mcp_tests,false);
assert.equal(policy.grant_type,"authorization_code");
assert.equal(policy.pkce_required_for_public_clients,true);
assert.equal(policy.code_challenge_method_required,"S256");
assert.equal(policy.plain_code_challenge_forbidden,true);
for(const item of ["response_type=code","client_id","redirect_uri","scope","state","code_challenge","code_challenge_method=S256","resource"]){assert.ok(policy.authorization_request_requirements.includes(item),`auth request missing ${item}`);}
for(const item of ["grant_type=authorization_code","code","redirect_uri","client_id","code_verifier","resource"]){assert.ok(policy.token_request_requirements.includes(item),`token request missing ${item}`);}
assert.equal(policy.state_parameter_required,true);
assert.equal(policy.client_must_verify_state,true);
assert.equal(policy.exact_redirect_uri_validation_required_by_as,true);
assert.equal(policy.resource_parameter_required_in_authorization_request,true);
assert.equal(policy.resource_parameter_required_in_token_request,true);
assert.equal(policy.resource_parameter_must_match_protected_resource_metadata_resource,true);
assert.equal(policy.server_role,"resource_server_validates_access_tokens_only");
assert.equal(policy.server_must_not_issue_authorization_codes,true);
assert.equal(policy.guard,"_tests/smoke_stage12_oauth_pkce_policy.js");
console.log("smoke_stage12_oauth_pkce_policy ok");
