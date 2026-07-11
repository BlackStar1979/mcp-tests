"use strict";
const assert=require("node:assert/strict");
const {createOAuth21AuthorizationServer,sha256Base64Url}=require("../src/auth/oauth21_authorization_server");

function setupServer(options={}) {
  const server=createOAuth21AuthorizationServer({
    issuer:"https://example.test",
    operatorSecret:"stage12-oauth21-operator-secret",
    loginLimit:2,
    loginWindowMs:60000,
    ...options,
  });
  const redirectUri="https://client.example/callback";
  const registration=server.registerClient({
    redirect_uris:[redirectUri],
    token_endpoint_auth_method:"none",
  });
  const auth=server.authorize({
    client_id:registration.body.client_id,
    redirect_uri:redirectUri,
    response_type:"code",
    code_challenge_method:"S256",
    code_challenge:sha256Base64Url("abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz"),
    state:"login-throttle-smoke",
    resource:"https://example.test",
  });
  assert.equal(auth.status,302);
  return {
    server,
    pid:new URL(auth.location).searchParams.get("pid"),
    clientId:registration.body.client_id,
    redirectUri,
  };
}

const local=setupServer();
for (const spoofed of ["1.1.1.1","2.2.2.2","3.3.3.3"]) {
  const result=local.server.completeLogin({
    pid:local.pid,
    password:"wrong",
    clientId:local.clientId,
    redirectUri:local.redirectUri,
    scope:"mcp:tools",
    req:{ headers:{"x-forwarded-for":spoofed}, socket:{ remoteAddress:"127.0.0.1" } },
  });
  if (spoofed === "3.3.3.3") {
    assert.equal(result.status,429);
  } else {
    assert.equal(result.status,401);
  }
}

const trusted=setupServer({ trustedProxyHeaders:true });
const a=trusted.server.completeLogin({
  pid:trusted.pid,
  password:"wrong",
  clientId:trusted.clientId,
  redirectUri:trusted.redirectUri,
  scope:"mcp:tools",
  req:{ headers:{"x-forwarded-for":"1.1.1.1"}, socket:{ remoteAddress:"127.0.0.1" } },
});
const b=trusted.server.completeLogin({
  pid:trusted.pid,
  password:"wrong",
  clientId:trusted.clientId,
  redirectUri:trusted.redirectUri,
  scope:"mcp:tools",
  req:{ headers:{"x-forwarded-for":"2.2.2.2"}, socket:{ remoteAddress:"127.0.0.1" } },
});
assert.equal(a.status,401);
assert.equal(b.status,401);

console.log("smoke_oauth21_login_throttle_proxy_hardening ok");
