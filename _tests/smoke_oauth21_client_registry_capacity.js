"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createOAuth21AuthorizationServer, sha256Base64Url } = require("../src/auth/oauth21_authorization_server");

let fakeNow = Date.parse("2026-07-16T12:00:00.000Z");
const now = () => fakeNow;

function approveGrant(server, clientId, redirectUri, resource, state) {
  const authorize = server.authorize({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url("abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz"),
    state,
    resource,
  });
  assert.equal(authorize.status, 302);
  const pid = new URL(authorize.location).searchParams.get("pid");
  const login = server.completeLogin({
    pid,
    password: "stage12-oauth21-client-registry-secret",
    clientId,
    redirectUri,
    scope: "mcp:tools",
    req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} },
  });
  assert.equal(login.status, 302);
  const code = new URL(login.location).searchParams.get("code");
  const token = server.token({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz",
    resource,
  });
  assert.equal(token.status, 200);
  return token.body;
}

(async () => {
  const issuer = "https://example.test";
  const resource = `${issuer}/mcp`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-oauth21-client-registry-"));
  const originalStateEnv = process.env.MCP_TEST_OAUTH_STATE_FILE;
  const originalClientsEnv = process.env.MCP_TEST_OAUTH_CLIENTS_FILE;

  try {
    process.env.MCP_TEST_OAUTH_STATE_FILE = path.join(tempDir, "capacity-state.json");
    process.env.MCP_TEST_OAUTH_CLIENTS_FILE = path.join(tempDir, "capacity-clients.json");
    const rejectionAudit = [];
    const cappedServer = createOAuth21AuthorizationServer({
      issuer,
      resource,
      operatorSecret: "stage12-oauth21-client-registry-secret",
      clientRegistryLimit: 2,
      storageFile: path.join(tempDir, "capacity.sqlite"),
      clientsFile: path.join(tempDir, "capacity-clients.json"),
      now,
    });
    cappedServer.setAuditLog((event, data) => rejectionAudit.push({ event, data }));
    assert.equal(cappedServer.registerClient({ redirect_uris: ["https://client-1.example/callback"], token_endpoint_auth_method: "none" }).status, 201);
    assert.equal(cappedServer.registerClient({ redirect_uris: ["https://client-2.example/callback"], token_endpoint_auth_method: "none" }).status, 201);
    const rejected = cappedServer.registerClient({ redirect_uris: ["https://client-3.example/callback"], token_endpoint_auth_method: "none" });
    assert.deepEqual(rejected, { status: 503, body: { error: "server_error", error_description: "client_registry_capacity_exceeded" } });
    assert.ok(rejectionAudit.some((item) => item.event === "oauth21_client_registration_failed" && item.data.reason === "client_registry_capacity_exceeded"));

    fakeNow = Date.parse("2026-07-16T12:00:00.000Z");
    process.env.MCP_TEST_OAUTH_STATE_FILE = path.join(tempDir, "prune-state.json");
    process.env.MCP_TEST_OAUTH_CLIENTS_FILE = path.join(tempDir, "prune-clients.json");
    const pruneAudit = [];
    const pruningServer = createOAuth21AuthorizationServer({
      issuer,
      resource,
      operatorSecret: "stage12-oauth21-client-registry-secret",
      clientRegistryLimit: 2,
      storageFile: path.join(tempDir, "prune.sqlite"),
      clientsFile: path.join(tempDir, "prune-clients.json"),
      now,
    });
    pruningServer.setAuditLog((event, data) => pruneAudit.push({ event, data }));

    const staleClient = pruningServer.registerClient({ redirect_uris: ["https://stale.example/callback"], token_endpoint_auth_method: "none" });
    assert.equal(staleClient.status, 201);
    const activeClient = pruningServer.registerClient({ redirect_uris: ["https://active.example/callback"], token_endpoint_auth_method: "none" });
    assert.equal(activeClient.status, 201);
    approveGrant(pruningServer, activeClient.body.client_id, "https://active.example/callback", resource, "registry-capacity");

    fakeNow += 15 * 86400 * 1000;
    const replacement = pruningServer.registerClient({ redirect_uris: ["https://replacement.example/callback"], token_endpoint_auth_method: "none" });
    assert.equal(replacement.status, 201);
    const status = pruningServer.status();
    assert.equal(status.clients, 2);
    assert.equal(status.client_registry_limit, 2);
    assert.equal(status.client_registry_capacity_remaining, 0);
    assert.equal(status.dead_clients, 1);
    assert.ok(pruneAudit.some((item) => item.event === "oauth21_dead_clients_pruned" && item.data.pruned_count === 1));

    const staleAuthorize = pruningServer.authorize({
      client_id: staleClient.body.client_id,
      redirect_uri: "https://stale.example/callback",
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: sha256Base64Url("abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz"),
      state: "stale-removed",
      resource,
    });
    assert.equal(staleAuthorize.status, 400);
    assert.equal(staleAuthorize.body.error, "invalid_client");

    console.log("smoke_oauth21_client_registry_capacity ok");
  } finally {
    if (originalStateEnv === undefined) delete process.env.MCP_TEST_OAUTH_STATE_FILE;
    else process.env.MCP_TEST_OAUTH_STATE_FILE = originalStateEnv;
    if (originalClientsEnv === undefined) delete process.env.MCP_TEST_OAUTH_CLIENTS_FILE;
    else process.env.MCP_TEST_OAUTH_CLIENTS_FILE = originalClientsEnv;
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
