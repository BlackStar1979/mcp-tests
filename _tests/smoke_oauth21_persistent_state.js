const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createOAuth21AuthorizationServer, sha256Base64Url } = require("../src/auth/oauth21_authorization_server");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oauth-state-"));
const clientsFile = path.join(tmp, "clients.json");
const stateFile = path.join(tmp, "state.json");
process.env.MCP_TEST_OAUTH_STATE_FILE = stateFile;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const issuer = "http://127.0.0.1:3008";
const resource = `${issuer}/mcp`;
const operatorSecret = "operator-secret";
const redirectUri = "https://chat.openai.com/aip/callback";
const verifier = "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";
let fakeNow = Date.UTC(2026, 0, 1, 0, 0, 0);

function now() {
  return fakeNow;
}

function issueAuthorizationCodeGrant(server, clientId, stateValue) {
  const auth = server.authorize({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state: stateValue,
    resource,
  });
  assert.equal(auth.status, 302);
  const pid = new URL(auth.location).searchParams.get("pid");
  const login = server.completeLogin({ pid, password: operatorSecret, clientId, redirectUri, scope: "mcp:tools", req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} } });
  assert.equal(login.status, 302);
  const code = new URL(login.location).searchParams.get("code");
  const issued = server.token({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier, resource });
  assert.equal(issued.status, 200);
  return issued.body;
}

const events1 = [];
const server1 = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
server1.setAuditLog((event, data) => events1.push({ event, data }));
assert.ok(events1.some((x) => x.event === "oauth21_state_missing"));
const registration = server1.registerClient({ redirect_uris: [redirectUri], token_endpoint_auth_method: "none" });
assert.equal(registration.status, 201);
const clientId = registration.body.client_id;
const missingAuthorizeResource = server1.authorize({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  code_challenge_method: "S256",
  code_challenge: sha256Base64Url(verifier),
  state: "missing-resource",
});
assert.deepEqual(missingAuthorizeResource, { status: 400, body: { error: "invalid_target", error_description: "resource_required" } });
assert.ok(events1.some((x) => x.event === "oauth21_authorize_rejected" && x.data.reason === "resource_required"));
const issued = issueAuthorizationCodeGrant(server1, clientId, "abc");
assert.ok(issued.access_token);
assert.ok(issued.refresh_token);
assert.ok(fs.existsSync(stateFile));
assert.ok(events1.some((x) => x.event === "oauth21_state_saved"));

const events2 = [];
const server2 = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
server2.setAuditLog((event, data) => events2.push({ event, data }));
assert.ok(events2.some((x) => x.event === "oauth21_state_loaded"));
assert.equal(server2.validateAccessToken(issued.access_token, { audience: resource }).ok, true);
assert.equal(server2.validateAccessToken(issued.access_token, { audience: issuer }).ok, true);
assert.ok(events2.some((x) => x.event === "oauth21_access_token_accepted"));
const refreshed = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: issued.refresh_token, resource });
assert.equal(refreshed.status, 200);
assert.ok(events2.some((x) => x.event === "oauth21_refresh_token_accepted"));
assert.ok(refreshed.body.access_token);
assert.notEqual(refreshed.body.refresh_token, issued.refresh_token);
const refreshReplay = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: issued.refresh_token, resource });
assert.equal(refreshReplay.status, 200);
assert.deepEqual(refreshReplay.body, refreshed.body);
assert.ok(events2.some((x) => x.event === "oauth21_refresh_token_replayed"));
const badRefreshResource = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshed.body.refresh_token, resource: "https://example.test/mcp" });
assert.deepEqual(badRefreshResource, { status: 400, body: { error: "invalid_target", error_description: "resource_mismatch" } });
assert.ok(events2.some((x) => x.event === "oauth21_token_rejected" && x.data.reason === "resource_mismatch" && x.data.grant_type === "refresh_token"));

fakeNow += 61 * 1000;
const replay = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: issued.refresh_token, resource });
assert.equal(replay.status, 400);
assert.equal(replay.body.error, "invalid_grant");
assert.ok(events2.some((x) => x.event === "oauth21_refresh_token_rejected" && x.data.reason === "refresh_token_reuse_detected"));

const revokedByReplay = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshed.body.refresh_token, resource });
assert.equal(revokedByReplay.status, 400);
assert.equal(revokedByReplay.body.error, "invalid_grant");

const events3 = [];
const server3 = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
server3.setAuditLog((event, data) => events3.push({ event, data }));
const replayAfterRestart = server3.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: issued.refresh_token, resource });
assert.equal(replayAfterRestart.status, 400);
assert.equal(replayAfterRestart.body.error, "invalid_grant");
assert.ok(events3.some((x) => x.event === "oauth21_refresh_token_rejected" && x.data.reason === "refresh_token_reuse_detected"));

const server4 = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
const staleInstanceGrant = issueAuthorizationCodeGrant(server4, clientId, "stale-instance-grant");
const server5 = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
const rotatedFromFreshInstance = server4.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: staleInstanceGrant.refresh_token, resource });
assert.equal(rotatedFromFreshInstance.status, 200);
const staleSnapshotWrite = issueAuthorizationCodeGrant(server5, clientId, "stale-snapshot-write");
assert.ok(staleSnapshotWrite.access_token);
const server6 = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
const rotatedAfterConcurrentSave = server6.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: rotatedFromFreshInstance.body.refresh_token, resource });
assert.equal(rotatedAfterConcurrentSave.status, 200);

const clientsServerA = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
const clientsServerB = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
const clientA = clientsServerA.registerClient({ redirect_uris: ["https://client-a.example/callback"], token_endpoint_auth_method: "none" });
const clientB = clientsServerB.registerClient({ redirect_uris: ["https://client-b.example/callback"], token_endpoint_auth_method: "none" });
assert.equal(clientA.status, 201);
assert.equal(clientB.status, 201);
const persistedClients = readJson(clientsFile);
assert.ok(Array.isArray(persistedClients));
assert.ok(persistedClients.some((entry) => entry.client_id === clientA.body.client_id));
assert.ok(persistedClients.some((entry) => entry.client_id === clientB.body.client_id));
fakeNow += 15 * 86400 * 1000;
const prunePreview = clientsServerA.status().prune_preview;
assert.equal(prunePreview.success, true);
assert.equal(prunePreview.execute_allowed_now, false);
assert.equal(prunePreview.raw_identifiers_redacted, true);
assert.equal(prunePreview.candidate_counts.dead_clients_eligible >= 1, true);
assert.equal(Array.isArray(prunePreview.sample_candidates.dead_clients_eligible), true);
assert.equal(typeof prunePreview.sample_candidates.dead_clients_eligible[0]?.client_id_hash, "string");
assert.equal(prunePreview.sample_candidates.dead_clients_eligible[0]?.client_id_hash.length, 12);

  console.log("smoke_oauth21_persistent_state ok");
