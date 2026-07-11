"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createOAuth21AuthorizationServer,
  sha256Base64Url,
} = require("../src/auth/oauth21_authorization_server");
const {
  createOAuth21McpAuthorizationServer,
} = require("../src/auth/oauth21_mcp_authorization_server");

const issuer = "https://example.test";
const redirectUri = "https://client.example/callback";
const verifier = "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";
const operatorSecret = "stage12-oauth21-operator-secret";
const requestContext = { headers: {}, socket: { remoteAddress: "127.0.0.1" } };

function register(server, uri = redirectUri) {
  const registration = server.registerClient({
    redirect_uris: [uri],
    token_endpoint_auth_method: "none",
  });
  assert.equal(registration.status, 201);
  return registration.body.client_id;
}

function authorize(server, clientId, resource, state) {
  return server.authorize({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state,
    resource,
  });
}

function approve(server, authorization, clientId) {
  const pid = new URL(authorization.location).searchParams.get("pid");
  const approved = server.completeLogin({
    pid,
    password: operatorSecret,
    clientId,
    redirectUri,
    scope: "mcp:tools",
    req: requestContext,
  });
  assert.equal(approved.status, 302);
  return new URL(approved.location).searchParams.get("code");
}

function exchange(server, clientId, code, resource) {
  return server.token({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
    resource,
  });
}

function exerciseIssuerBoundCore() {
  const server = createOAuth21AuthorizationServer({
    issuer,
    operatorSecret,
  });
  const clientId = register(server);

  const missingResourceAuthorize = server.authorize({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state: "resource-missing",
  });
  assert.equal(missingResourceAuthorize.status, 400);
  assert.equal(missingResourceAuthorize.body.error, "invalid_target");
  assert.equal(missingResourceAuthorize.body.error_description, "resource_required");

  const authorization = authorize(server, clientId, issuer, "resource-good-1");
  assert.equal(authorization.status, 302);
  const code = approve(server, authorization, clientId);

  const wrongResourceToken = exchange(server, clientId, code, "https://other.example");
  assert.equal(wrongResourceToken.status, 400);
  assert.equal(wrongResourceToken.body.error, "invalid_target");
  assert.equal(wrongResourceToken.body.error_description, "resource_mismatch");

  const secondAuthorization = authorize(server, clientId, issuer, "resource-good-2");
  const secondCode = approve(server, secondAuthorization, clientId);
  const token = exchange(server, clientId, secondCode, issuer);
  assert.equal(token.status, 200);
  assert.equal(server.validateAccessToken(token.body.access_token, { audience: issuer }).ok, true);
  assert.equal(server.validateAccessToken(token.body.access_token, { audience: "https://other.example" }).ok, false);

  const refreshed = server.token({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: token.body.refresh_token,
    resource: issuer,
  });
  assert.equal(refreshed.status, 200);

  const badRefresh = server.token({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshed.body.refresh_token,
    resource: "https://other.example",
  });
  assert.equal(badRefresh.status, 400);
  assert.equal(badRefresh.body.error, "invalid_target");
  assert.equal(badRefresh.body.error_description, "resource_mismatch");

  const loopbackRegistration = server.registerClient({
    redirect_uris: ["http://127.0.0.1:1/callback"],
    token_endpoint_auth_method: "none",
  });
  assert.equal(loopbackRegistration.status, 201);
  const loopbackAuthorize = server.authorize({
    client_id: loopbackRegistration.body.client_id,
    redirect_uri: "http://127.0.0.1:43121/callback",
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state: "loopback-port-flex",
    resource: issuer,
  });
  assert.equal(loopbackAuthorize.status, 302);
}

function exerciseCanonicalMcpResource() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oauth-resource-adapter-"));
  const previousStateFile = process.env.MCP_TEST_OAUTH_STATE_FILE;
  process.env.MCP_TEST_OAUTH_STATE_FILE = path.join(tmp, "state.json");

  try {
    const resource = `${issuer}/mcp`;
    const server = createOAuth21McpAuthorizationServer({
      issuer,
      resource,
      operatorSecret,
      clientsFile: path.join(tmp, "clients.json"),
    });
    const clientId = register(server);

    const authorization = authorize(server, clientId, resource, "canonical-resource");
    assert.equal(authorization.status, 302);
    const code = approve(server, authorization, clientId);
    const token = exchange(server, clientId, code, resource);
    assert.equal(token.status, 200);
    assert.equal(server.validateAccessToken(token.body.access_token, { audience: resource }).ok, true);
    assert.equal(server.validateAccessToken(token.body.access_token, { audience: issuer }).ok, false);

    const legacyAuthorization = authorize(server, clientId, issuer, "legacy-issuer-alias");
    assert.equal(legacyAuthorization.status, 302);
    const legacyCode = approve(server, legacyAuthorization, clientId);
    const legacyToken = exchange(server, clientId, legacyCode, issuer);
    assert.equal(legacyToken.status, 200);
    assert.equal(server.validateAccessToken(legacyToken.body.access_token, { audience: resource }).ok, true);

    const wrongAuthorization = authorize(server, clientId, "https://other.example/mcp", "wrong-resource");
    assert.equal(wrongAuthorization.status, 400);
    assert.equal(wrongAuthorization.body.error, "invalid_target");
    assert.equal(wrongAuthorization.body.error_description, "resource_mismatch");

    assert.equal(server.status().resource, resource);
    assert.equal(server.status().issuer_resource_alias_enabled, true);
  } finally {
    if (previousStateFile === undefined) delete process.env.MCP_TEST_OAUTH_STATE_FILE;
    else process.env.MCP_TEST_OAUTH_STATE_FILE = previousStateFile;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

exerciseIssuerBoundCore();
exerciseCanonicalMcpResource();

console.log("smoke_oauth21_resource_binding ok");
