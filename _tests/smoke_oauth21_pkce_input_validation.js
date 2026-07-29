"use strict";
const assert=require("node:assert/strict");
const {createOAuth21AuthorizationServer,sha256Base64Url}=require("../src/auth/oauth21_authorization_server");

const issuer="https://example.test";
const operatorSecret="stage12-oauth21-operator-secret";
const server=createOAuth21AuthorizationServer({issuer,operatorSecret});
const req={headers:{},socket:{remoteAddress:"127.0.0.1"}};
const audit=[];
server.setAuditLog((event,data)=>audit.push({event,data}));

const reg=server.registerClient({
  redirect_uris:["https://client.example/callback"],
  token_endpoint_auth_method:"none",
});
assert.equal(reg.status,201);

const badChallenge=server.authorize({
  response_type:"code",
  client_id:reg.body.client_id,
  redirect_uri:"https://client.example/callback",
  code_challenge:"short",
  code_challenge_method:"S256",
  state:"abc",
  scope:"mcp:tools",
  resource:issuer,
});
assert.equal(badChallenge.status,400);
assert.equal(badChallenge.body.error,"invalid_request");
assert.equal(badChallenge.body.error_description,"code_challenge_invalid");

for(const challenge of [
  "A".repeat(42),
  "A".repeat(44),
  `${"A".repeat(42)}.`,
  `${"A".repeat(42)}~`,
]){
  const rejected=server.authorize({
    response_type:"code",
    client_id:reg.body.client_id,
    redirect_uri:"https://client.example/callback",
    code_challenge:challenge,
    code_challenge_method:"S256",
    state:"challenge-boundary",
    scope:"mcp:tools",
    resource:issuer,
  });
  assert.equal(rejected.status,400);
  assert.equal(rejected.body.error_description,"code_challenge_invalid");
}

const verifier="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJK";
const authorize=server.authorize({
  response_type:"code",
  client_id:reg.body.client_id,
  redirect_uri:"https://client.example/callback",
  code_challenge:sha256Base64Url(verifier),
  code_challenge_method:"S256",
  state:"ok",
  scope:"mcp:tools",
  resource:issuer,
});
assert.equal(authorize.status,302);
const pid=new URL(authorize.location).searchParams.get("pid");

const login=server.completeLogin({
  pid,
  password:operatorSecret,
  req,
  clientId:reg.body.client_id,
  redirectUri:"https://client.example/callback",
  scope:"mcp:tools",
});
assert.equal(login.status,302);
const code=new URL(login.location).searchParams.get("code");

const badVerifier=server.token({
  grant_type:"authorization_code",
  code,
  redirect_uri:"https://client.example/callback",
  client_id:reg.body.client_id,
  code_verifier:"bad!",
  resource:issuer,
});
assert.equal(badVerifier.status,400);
assert.equal(badVerifier.body.error,"invalid_grant");
assert.equal(badVerifier.body.error_description,"code_verifier_invalid");

for(const invalidVerifier of [
  "A".repeat(42),
  "A".repeat(129),
  `${"A".repeat(42)}!`,
]){
  const rejected=server.token({
    grant_type:"authorization_code",
    code,
    redirect_uri:"https://client.example/callback",
    client_id:reg.body.client_id,
    code_verifier:invalidVerifier,
    resource:issuer,
  });
  assert.equal(rejected.status,400);
  assert.equal(rejected.body.error_description,"code_verifier_invalid");
}

const maxVerifier=`${"A".repeat(124)}._~-`;
const maxAuthorize=server.authorize({
  response_type:"code",
  client_id:reg.body.client_id,
  redirect_uri:"https://client.example/callback",
  code_challenge:sha256Base64Url(maxVerifier),
  code_challenge_method:"S256",
  state:"max-verifier",
  scope:"mcp:tools",
  resource:issuer,
});
assert.equal(maxAuthorize.status,302);
const maxPid=new URL(maxAuthorize.location).searchParams.get("pid");
const maxLogin=server.completeLogin({
  pid:maxPid,
  password:operatorSecret,
  req,
  clientId:reg.body.client_id,
  redirectUri:"https://client.example/callback",
  scope:"mcp:tools",
});
assert.equal(maxLogin.status,302);
const maxCode=new URL(maxLogin.location).searchParams.get("code");
const maxToken=server.token({
  grant_type:"authorization_code",
  code:maxCode,
  redirect_uri:"https://client.example/callback",
  client_id:reg.body.client_id,
  code_verifier:maxVerifier,
  resource:issuer,
});
assert.equal(maxToken.status,200);
assert.ok(maxToken.body.access_token);

assert.ok(audit.some(({event,data})=>event==="oauth21_authorize_rejected"&&data.reason==="code_challenge_invalid"));
assert.ok(audit.some(({event,data})=>event==="oauth21_token_rejected"&&data.reason==="code_verifier_invalid"));
assert.ok(!JSON.stringify(audit).includes(maxVerifier));
assert.ok(!JSON.stringify(audit).includes("bad!"));

console.log("smoke_oauth21_pkce_input_validation ok");
