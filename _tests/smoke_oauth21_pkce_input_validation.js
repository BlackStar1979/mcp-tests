"use strict";
const assert=require("node:assert/strict");
const {createOAuth21AuthorizationServer,sha256Base64Url}=require("../src/auth/oauth21_authorization_server");

const issuer="https://example.test";
const operatorSecret="stage12-oauth21-operator-secret";
const server=createOAuth21AuthorizationServer({issuer,operatorSecret});
const req={headers:{},socket:{remoteAddress:"127.0.0.1"}};

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

console.log("smoke_oauth21_pkce_input_validation ok");
