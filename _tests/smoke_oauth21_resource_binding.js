"use strict";
const assert=require("node:assert/strict");
const {createOAuth21AuthorizationServer,sha256Base64Url}=require("../src/auth/oauth21_authorization_server");

const issuer="https://example.test";
const redirectUri="https://client.example/callback";
const verifier="abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";
const server=createOAuth21AuthorizationServer({
  issuer,
  operatorSecret:"stage12-oauth21-operator-secret",
});

const registration=server.registerClient({
  redirect_uris:[redirectUri],
  token_endpoint_auth_method:"none",
});
assert.equal(registration.status,201);
const clientId=registration.body.client_id;

const missingResourceAuthorize=server.authorize({
  client_id:clientId,
  redirect_uri:redirectUri,
  response_type:"code",
  code_challenge_method:"S256",
  code_challenge:sha256Base64Url(verifier),
  state:"resource-missing",
});
assert.equal(missingResourceAuthorize.status,400);
assert.equal(missingResourceAuthorize.body.error,"invalid_target");
assert.equal(missingResourceAuthorize.body.error_description,"resource_required");

const authorize=server.authorize({
  client_id:clientId,
  redirect_uri:redirectUri,
  response_type:"code",
  code_challenge_method:"S256",
  code_challenge:sha256Base64Url(verifier),
  state:"resource-good-1",
  resource:issuer,
});
assert.equal(authorize.status,302);

const pid=new URL(authorize.location).searchParams.get("pid");
const approved=server.completeLogin({
  pid,
  password:"stage12-oauth21-operator-secret",
  clientId,
  redirectUri,
  scope:"mcp:tools",
  req:{ headers:{}, socket:{ remoteAddress:"127.0.0.1" } },
});
assert.equal(approved.status,302);

const code=new URL(approved.location).searchParams.get("code");
const wrongResourceToken=server.token({
  grant_type:"authorization_code",
  code,
  redirect_uri:redirectUri,
  client_id:clientId,
  code_verifier:verifier,
  resource:"https://other.example",
});
assert.equal(wrongResourceToken.status,400);
assert.equal(wrongResourceToken.body.error,"invalid_target");
assert.equal(wrongResourceToken.body.error_description,"resource_mismatch");

const authorized=server.authorize({
  client_id:clientId,
  redirect_uri:redirectUri,
  response_type:"code",
  code_challenge_method:"S256",
  code_challenge:sha256Base64Url(verifier),
  state:"resource-good-2",
  resource:issuer,
});
const pid2=new URL(authorized.location).searchParams.get("pid");
const approved2=server.completeLogin({
  pid:pid2,
  password:"stage12-oauth21-operator-secret",
  clientId,
  redirectUri,
  scope:"mcp:tools",
  req:{ headers:{}, socket:{ remoteAddress:"127.0.0.1" } },
});
const code2=new URL(approved2.location).searchParams.get("code");
const token=server.token({
  grant_type:"authorization_code",
  code:code2,
  redirect_uri:redirectUri,
  client_id:clientId,
  code_verifier:verifier,
  resource:issuer,
});
assert.equal(token.status,200);
assert.equal(server.validateAccessToken(token.body.access_token,{audience:issuer}).ok,true);
assert.equal(server.validateAccessToken(token.body.access_token,{audience:"https://other.example"}).ok,false);

const refreshed=server.token({
  grant_type:"refresh_token",
  client_id:clientId,
  refresh_token:token.body.refresh_token,
  resource:issuer,
});
assert.equal(refreshed.status,200);

const badRefresh=server.token({
  grant_type:"refresh_token",
  client_id:clientId,
  refresh_token:refreshed.body.refresh_token,
  resource:"https://other.example",
});
assert.equal(badRefresh.status,400);
assert.equal(badRefresh.body.error,"invalid_target");
assert.equal(badRefresh.body.error_description,"resource_mismatch");

console.log("smoke_oauth21_resource_binding ok");
