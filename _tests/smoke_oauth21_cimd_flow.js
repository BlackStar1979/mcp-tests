"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createOAuth21AuthorizationServer } = require("../src/auth/oauth21_authorization_server");

function challenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

(async () => {
  const issuer = "https://as.example";
  const resource = "https://resource.example/mcp";
  const clientId = "https://client.example/oauth/client.json";
  const redirectUri = "http://127.0.0.1:3210/callback";
  let resolverCalls = 0;
  const cimdResolver = {
    resolve: async (value) => {
      resolverCalls += 1;
      assert.equal(value, clientId);
      return {
        client: {
          client_id: clientId,
          client_name: "CIMD Example",
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        cacheHit: resolverCalls > 1,
      };
    },
  };

  const server = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret: "operator-secret", cimdResolver });
  const metadata = server.metadata();
  assert.equal(metadata.client_id_metadata_document_supported, true);
  assert.equal(metadata.registration_endpoint, `${issuer}/register`);

  const dcr = server.registerClient({
    redirect_uris: ["http://127.0.0.1:3220/callback"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
  assert.equal(dcr.status, 201, "DCR remains available for compatibility");

  const verifier = "A".repeat(43);
  const wrongLoopbackPort = await server.authorize({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "http://127.0.0.1:3211/callback",
    code_challenge: challenge(verifier),
    code_challenge_method: "S256",
    state: "cimd-wrong-port",
    scope: "mcp:tools",
    resource,
  });
  assert.equal(wrongLoopbackPort.status, 400);
  assert.equal(wrongLoopbackPort.body.error_description, "redirect_uri_mismatch");

  const auth = await server.authorize({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge(verifier),
    code_challenge_method: "S256",
    state: "cimd-state",
    scope: "mcp:tools",
    resource,
  });
  assert.equal(auth.status, 302);
  assert.equal(resolverCalls, 2, "both CIMD authorization attempts resolve metadata before redirect validation");

  const pid = new URL(auth.location).searchParams.get("pid");
  const login = server.completeLogin({
    pid,
    password: "operator-secret",
    req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} },
    clientId,
    redirectUri,
    scope: "mcp:tools",
  });
  assert.equal(login.status, 302);
  const code = new URL(login.location).searchParams.get("code");

  const token = server.token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource });
  assert.equal(token.status, 200);
  assert.ok(token.body.access_token);
  assert.ok(token.body.refresh_token);

  const refresh = server.token({ grant_type: "refresh_token", refresh_token: token.body.refresh_token, client_id: clientId, resource });
  assert.equal(refresh.status, 200);
  assert.ok(refresh.body.access_token);
  assert.ok(refresh.body.refresh_token);

  const revoked = server.revoke({ token: refresh.body.refresh_token, client_id: clientId });
  assert.equal(revoked.status, 200);
  const afterRevoke = server.token({ grant_type: "refresh_token", refresh_token: refresh.body.refresh_token, client_id: clientId, resource });
  assert.equal(afterRevoke.status, 400);
  assert.equal(afterRevoke.body.error, "invalid_grant");

  const beforeUnknown = resolverCalls;
  const unknown = await server.authorize({
    response_type: "code",
    client_id: "opaque-unknown-client",
    redirect_uri: redirectUri,
    code_challenge: challenge(verifier),
    code_challenge_method: "S256",
    state: "unknown",
    scope: "mcp:tools",
    resource,
  });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error, "invalid_client");
  assert.equal(resolverCalls, beforeUnknown, "opaque unknown IDs must not trigger network resolution");

  console.log("smoke_oauth21_cimd_flow ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
