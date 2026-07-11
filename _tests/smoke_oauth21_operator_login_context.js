"use strict";
const assert=require("node:assert/strict");
const {createOAuth21AuthorizationServer,sha256Base64Url}=require("../src/auth/oauth21_authorization_server");

const server=createOAuth21AuthorizationServer({
  issuer:"https://example.test",
  operatorSecret:"stage12-oauth21-operator-secret",
});

const redirectUri="https://client.example/callback";
const registration=server.registerClient({
  redirect_uris:[redirectUri],
  token_endpoint_auth_method:"none",
});
assert.equal(registration.status,201);

const auth=server.authorize({
  client_id:registration.body.client_id,
  redirect_uri:redirectUri,
  response_type:"code",
  code_challenge_method:"S256",
  code_challenge:sha256Base64Url("abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz"),
  state:"abc",
  scope:"mcp:tools",
  resource:"https://example.test",
});
assert.equal(auth.status,302);

const pid=new URL(auth.location).searchParams.get("pid");
let html="";
const res={
  writeHead(){},
  end(body){ html=String(body||""); },
};

Promise.resolve(server.handleRoute({
  req:{ method:"GET", headers:{}, socket:{ remoteAddress:"127.0.0.1" } },
  res,
  url:new URL(`https://example.test/oauth/operator-login?pid=${encodeURIComponent(pid)}`),
})).then(() => {
  assert.ok(html.includes("Client ID:"));
  assert.ok(html.includes(registration.body.client_id));
  assert.ok(html.includes(redirectUri));
  assert.ok(html.includes("mcp:tools"));

  const tampered=server.completeLogin({
    pid,
    password:"stage12-oauth21-operator-secret",
    clientId:registration.body.client_id,
    redirectUri:"https://evil.example/callback",
    scope:"mcp:tools",
    req:{ headers:{}, socket:{ remoteAddress:"127.0.0.1" } },
  });
  assert.equal(tampered.status,400);
  assert.equal(tampered.body,"Authorization request binding mismatch");

  const approved=server.completeLogin({
    pid,
    password:"stage12-oauth21-operator-secret",
    clientId:registration.body.client_id,
    redirectUri,
    scope:"mcp:tools",
    req:{ headers:{}, socket:{ remoteAddress:"127.0.0.1" } },
  });
  assert.equal(approved.status,302);
  console.log("smoke_oauth21_operator_login_context ok");
}).catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
