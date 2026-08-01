"use strict";
const assert=require("node:assert/strict");
const {createOAuth21AuthorizationServer}=require("../src/auth/oauth21_authorization_server");

const server=createOAuth21AuthorizationServer({
  issuer:"https://example.test",
  operatorSecret:"stage12-oauth21-operator-secret",
});

const goodLocalhost=server.registerClient({
  redirect_uris:["http://localhost:3000/callback"],
  token_endpoint_auth_method:"none",
});
assert.equal(goodLocalhost.status,201);
assert.equal(goodLocalhost.body.application_type,"native");

const goodLoopback=server.registerClient({
  redirect_uris:["http://127.0.0.1:43121/cb"],
  token_endpoint_auth_method:"none",
});
assert.equal(goodLoopback.status,201);
assert.equal(goodLoopback.body.application_type,"native");

const goodLoopbackIpv6=server.registerClient({
  redirect_uris:["http://[::1]:43121/cb"],
  token_endpoint_auth_method:"none",
});
assert.equal(goodLoopbackIpv6.status,201);
assert.equal(goodLoopbackIpv6.body.application_type,"native");

const goodHttps=server.registerClient({
  redirect_uris:["https://client.example/callback"],
  token_endpoint_auth_method:"none",
  application_type:"web",
});
assert.equal(goodHttps.status,201);
assert.equal(goodHttps.body.application_type,"web");

const explicitNative=server.registerClient({
  redirect_uris:["http://127.0.0.1:43122/callback"],
  token_endpoint_auth_method:"none",
  application_type:"native",
});
assert.equal(explicitNative.status,201);
assert.equal(explicitNative.body.application_type,"native");

const invalidApplicationType=server.registerClient({
  redirect_uris:["https://client.example/callback"],
  token_endpoint_auth_method:"none",
  application_type:"desktop",
});
assert.equal(invalidApplicationType.status,400);
assert.equal(invalidApplicationType.body.error_description,"application_type_invalid");

for (const [uri, reason] of [
  ["file:///tmp/callback","redirect_uri_file_forbidden"],
  ["javascript:alert(1)","redirect_uri_javascript_forbidden"],
  ["https://user:pass@client.example/callback","redirect_uri_userinfo_forbidden"],
  ["http://evil.example/callback","redirect_uri_scheme_not_allowed"],
  ["https://client.example/callback#frag","redirect_uri_fragment_forbidden"],
  ["https://client.example/*","redirect_uri_wildcard_forbidden"],
]) {
  const result=server.registerClient({
    redirect_uris:[uri],
    token_endpoint_auth_method:"none",
  });
  assert.equal(result.status,400,uri);
  assert.equal(result.body.error,"invalid_client_metadata",uri);
  assert.equal(result.body.error_description,reason,uri);
}

console.log("smoke_oauth21_dcr_runtime_validation ok");
