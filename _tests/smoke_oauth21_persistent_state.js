const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createOAuth21AuthorizationServer, sha256Base64Url } = require("../src/auth/oauth21_authorization_server");
const { createOAuth21PersistenceStore } = require("../src/auth/oauth21_persistence_store");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oauth-state-"));
const clientsFile = path.join(tmp, "clients.json");
const stateFile = path.join(tmp, "state.json");
const sqliteStorageFile = path.join(tmp, "oauth.sqlite");
delete process.env.MCP_TEST_OAUTH_STORAGE_FILE;
process.env.MCP_TEST_OAUTH_STATE_FILE = stateFile;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listMigratedFiles(filePath) {
  const dir = path.dirname(filePath);
  const prefix = `${path.basename(filePath)}.migrated-`;
  return fs.readdirSync(dir).filter((entry) => entry.startsWith(prefix));
}

function readSqliteCount(filePath, tableName) {
  const db = new DatabaseSync(filePath);
  try {
    return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count || 0);
  } finally {
    db.close();
  }
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
const refreshedWithoutResource = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshed.body.refresh_token });
assert.equal(refreshedWithoutResource.status, 200);
assert.ok(refreshedWithoutResource.body.access_token);
assert.notEqual(refreshedWithoutResource.body.refresh_token, refreshed.body.refresh_token);
const refreshReplay = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: issued.refresh_token, resource });
assert.equal(refreshReplay.status, 200);
assert.deepEqual(refreshReplay.body, refreshed.body);
assert.ok(events2.some((x) => x.event === "oauth21_refresh_token_replayed"));
const badRefreshResource = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshedWithoutResource.body.refresh_token, resource: "https://example.test/mcp" });
assert.deepEqual(badRefreshResource, { status: 400, body: { error: "invalid_target", error_description: "resource_mismatch" } });
assert.ok(events2.some((x) => x.event === "oauth21_token_rejected" && x.data.reason === "resource_mismatch" && x.data.grant_type === "refresh_token"));

fakeNow += 16 * 60 * 1000;
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

const auditFailureWarnings = [];
const auditFailureServer = createOAuth21AuthorizationServer({
  issuer,
  resource,
  operatorSecret,
  clientsFile,
  now,
  warnLogger: (...parts) => auditFailureWarnings.push(parts.join(" ")),
});
auditFailureServer.setAuditLog(() => {
  throw new Error("audit sink offline");
});
const auditFailureRegistration = auditFailureServer.registerClient({ redirect_uris: ["https://audit-failure.example/callback"], token_endpoint_auth_method: "none" });
assert.equal(auditFailureRegistration.status, 201);
assert.ok(auditFailureWarnings.some((line) => line.includes("OAUTH21_AUDIT_LOG_FAILED:") && line.includes("audit sink offline")));

const persistenceWarnTmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oauth-persistence-warn-"));
const persistenceWarnClientsFile = path.join(persistenceWarnTmp, "clients.json");
const persistenceWarnStateFile = path.join(persistenceWarnTmp, "state.json");
const persistenceWarnStorageFile = path.join(persistenceWarnTmp, "oauth.sqlite");
fs.writeFileSync(
  persistenceWarnClientsFile,
  JSON.stringify([{ client_id: "bootstrap-client", redirect_uris: [redirectUri], token_endpoint_auth_method: "none" }], null, 2),
);
fs.writeFileSync(
  persistenceWarnStateFile,
  JSON.stringify({
    access: [],
    refresh: [],
    used_refresh: [],
  }, null, 2),
);
const persistenceAuditFailureWarnings = [];
const persistenceStore = createOAuth21PersistenceStore({
  storageFile: persistenceWarnStorageFile,
  clientsPath: persistenceWarnClientsFile,
  oauthStatePath: persistenceWarnStateFile,
  canonicalResource: resource,
  resourceAliases: [issuer],
  now,
  onAudit: () => {
    throw new Error("persistence audit sink offline");
  },
  warnLogger: (...parts) => persistenceAuditFailureWarnings.push(parts.join(" ")),
});
const persistenceLoadedClients = persistenceStore.loadClients();
assert.equal(persistenceLoadedClients.clientCount, 1);
assert.ok(
  persistenceAuditFailureWarnings.some(
    (line) => line.includes("OAUTH21_PERSISTENCE_AUDIT_LOG_FAILED:") && line.includes("persistence audit sink offline"),
  ),
);

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

const failureStateFile = path.join(tmp, "state-save-failure.json");
const failureClientsFile = path.join(tmp, "clients-save-failure.json");
process.env.MCP_TEST_OAUTH_STATE_FILE = failureStateFile;
const originalRenameSync = fs.renameSync;
const originalCopyFileSync = fs.copyFileSync;
fs.renameSync = (fromPath, toPath) => {
  if (String(toPath) === failureStateFile || String(toPath) === failureClientsFile) {
    const error = new Error("rename blocked");
    error.code = "EPERM";
    throw error;
  }
  return originalRenameSync(fromPath, toPath);
};
fs.copyFileSync = (fromPath, toPath) => {
  if (String(toPath) === failureStateFile || String(toPath) === failureClientsFile) {
    const error = new Error("copy blocked");
    error.code = "EPERM";
    throw error;
  }
  return originalCopyFileSync(fromPath, toPath);
};

try {
  const failureAudit = [];
  const failingServer = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
  failingServer.setAuditLog((event, data) => failureAudit.push({ event, data }));
  const failingRegistration = failingServer.registerClient({ redirect_uris: ["https://failure.example/callback"], token_endpoint_auth_method: "none" });
  assert.equal(failingRegistration.status, 201);
  const failureAuthorize = failingServer.authorize({
    client_id: failingRegistration.body.client_id,
    redirect_uri: "https://failure.example/callback",
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state: "state-save-failure",
    resource,
  });
  assert.equal(failureAuthorize.status, 302);
  const failurePid = new URL(failureAuthorize.location).searchParams.get("pid");
  const failureLogin = failingServer.completeLogin({
    pid: failurePid,
    password: operatorSecret,
    clientId: failingRegistration.body.client_id,
    redirectUri: "https://failure.example/callback",
    scope: "mcp:tools",
    req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} },
  });
  assert.equal(failureLogin.status, 302);
  const failureCode = new URL(failureLogin.location).searchParams.get("code");
  const failingToken = failingServer.token({
    grant_type: "authorization_code",
    client_id: failingRegistration.body.client_id,
    code: failureCode,
    redirect_uri: "https://failure.example/callback",
    code_verifier: verifier,
    resource,
  });
  assert.deepEqual(failingToken, { status: 500, body: { error: "server_error", error_description: "state_persistence_failed" } });
  assert.ok(failureAudit.some((x) => x.event === "oauth21_issue_failed" && x.data.reason === "state_persistence_failed"));
  assert.equal(fs.existsSync(failureStateFile), false);

  const failingClientAudit = [];
  const failingClientServer = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile: failureClientsFile, now });
  failingClientServer.setAuditLog((event, data) => failingClientAudit.push({ event, data }));
  const failingClientRegistration = failingClientServer.registerClient({ redirect_uris: ["https://client-failure.example/callback"], token_endpoint_auth_method: "none" });
  assert.deepEqual(failingClientRegistration, { status: 500, body: { error: "server_error", error_description: "client_persistence_failed" } });
  assert.ok(failingClientAudit.some((x) => x.event === "oauth21_client_registration_failed" && x.data.reason === "client_persistence_failed"));
  assert.equal(fs.existsSync(failureClientsFile), false);

  fs.renameSync = originalRenameSync;
  fs.copyFileSync = originalCopyFileSync;
  process.env.MCP_TEST_OAUTH_STATE_FILE = stateFile;
  const revokeAudit = [];
  const revokeServer = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
  revokeServer.setAuditLog((event, data) => revokeAudit.push({ event, data }));
  const revokeRegistration = revokeServer.registerClient({ redirect_uris: ["https://revoke-failure.example/callback"], token_endpoint_auth_method: "none" });
  assert.equal(revokeRegistration.status, 201);
  const revokeAuthorize = revokeServer.authorize({
    client_id: revokeRegistration.body.client_id,
    redirect_uri: "https://revoke-failure.example/callback",
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state: "revoke-failure",
    resource,
  });
  assert.equal(revokeAuthorize.status, 302);
  const revokePid = new URL(revokeAuthorize.location).searchParams.get("pid");
  const revokeLogin = revokeServer.completeLogin({
    pid: revokePid,
    password: operatorSecret,
    clientId: revokeRegistration.body.client_id,
    redirectUri: "https://revoke-failure.example/callback",
    scope: "mcp:tools",
    req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} },
  });
  assert.equal(revokeLogin.status, 302);
  const revokeCode = new URL(revokeLogin.location).searchParams.get("code");
  const revokeToken = revokeServer.token({
    grant_type: "authorization_code",
    client_id: revokeRegistration.body.client_id,
    code: revokeCode,
    redirect_uri: "https://revoke-failure.example/callback",
    code_verifier: verifier,
    resource,
  });
  assert.equal(revokeToken.status, 200);
  fs.renameSync = (fromPath, toPath) => {
    if (String(toPath) === stateFile) {
      const error = new Error("rename blocked");
      error.code = "EPERM";
      throw error;
    }
    return originalRenameSync(fromPath, toPath);
  };
  fs.copyFileSync = (fromPath, toPath) => {
    if (String(toPath) === stateFile) {
      const error = new Error("copy blocked");
      error.code = "EPERM";
      throw error;
    }
    return originalCopyFileSync(fromPath, toPath);
  };
  const revokeFailure = revokeServer.revoke({ token: revokeToken.body.access_token, client_id: revokeRegistration.body.client_id });
  assert.deepEqual(revokeFailure, { status: 500, body: { error: "server_error", error_description: "state_persistence_failed" } });
  assert.equal(revokeServer.validateAccessToken(revokeToken.body.access_token, { audience: resource }).ok, true);
  assert.ok(revokeAudit.some((x) => x.event === "oauth21_revoke_failed" && x.data.reason === "state_persistence_failed"));

  fs.renameSync = originalRenameSync;
  fs.copyFileSync = originalCopyFileSync;
  fakeNow += 1;
  const replayFailureAudit = [];
  const replayFailureServer = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, now });
  replayFailureServer.setAuditLog((event, data) => replayFailureAudit.push({ event, data }));
  const replayRegistration = replayFailureServer.registerClient({ redirect_uris: ["https://replay-failure.example/callback"], token_endpoint_auth_method: "none" });
  assert.equal(replayRegistration.status, 201);
  const replayAuthorize = replayFailureServer.authorize({
    client_id: replayRegistration.body.client_id,
    redirect_uri: "https://replay-failure.example/callback",
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
    state: "replay-failure",
    resource,
  });
  assert.equal(replayAuthorize.status, 302);
  const replayPid = new URL(replayAuthorize.location).searchParams.get("pid");
  const replayLogin = replayFailureServer.completeLogin({
    pid: replayPid,
    password: operatorSecret,
    clientId: replayRegistration.body.client_id,
    redirectUri: "https://replay-failure.example/callback",
    scope: "mcp:tools",
    req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} },
  });
  assert.equal(replayLogin.status, 302);
  const replayCode = new URL(replayLogin.location).searchParams.get("code");
  const replayGrant = replayFailureServer.token({
    grant_type: "authorization_code",
    client_id: replayRegistration.body.client_id,
    code: replayCode,
    redirect_uri: "https://replay-failure.example/callback",
    code_verifier: verifier,
    resource,
  });
  assert.equal(replayGrant.status, 200);
  const rotatedReplayGrant = replayFailureServer.token({
    grant_type: "refresh_token",
    client_id: replayRegistration.body.client_id,
    refresh_token: replayGrant.body.refresh_token,
    resource,
  });
  assert.equal(rotatedReplayGrant.status, 200);
  fakeNow += 16 * 60 * 1000;
  fs.renameSync = (fromPath, toPath) => {
    if (String(toPath) === stateFile) {
      const error = new Error("rename blocked");
      error.code = "EPERM";
      throw error;
    }
    return originalRenameSync(fromPath, toPath);
  };
  fs.copyFileSync = (fromPath, toPath) => {
    if (String(toPath) === stateFile) {
      const error = new Error("copy blocked");
      error.code = "EPERM";
      throw error;
    }
    return originalCopyFileSync(fromPath, toPath);
  };
  const replayReuse = replayFailureServer.token({
    grant_type: "refresh_token",
    client_id: replayRegistration.body.client_id,
    refresh_token: replayGrant.body.refresh_token,
    resource,
  });
  assert.deepEqual(replayReuse, { status: 400, body: { error: "invalid_grant" } });
  fs.renameSync = originalRenameSync;
  fs.copyFileSync = originalCopyFileSync;
  const activeAfterFailedReplayRevocation = replayFailureServer.token({
    grant_type: "refresh_token",
    client_id: replayRegistration.body.client_id,
    refresh_token: rotatedReplayGrant.body.refresh_token,
    resource,
  });
  assert.equal(activeAfterFailedReplayRevocation.status, 200);
  assert.ok(replayFailureAudit.some((x) => x.event === "oauth21_refresh_token_rejected" && x.data.reason === "state_persistence_failed"));
} finally {
  fs.renameSync = originalRenameSync;
  fs.copyFileSync = originalCopyFileSync;
  process.env.MCP_TEST_OAUTH_STATE_FILE = stateFile;
}

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

const sqliteAudit = [];
const sqliteServer = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, storageFile: sqliteStorageFile, now });
sqliteServer.setAuditLog((event, data) => sqliteAudit.push({ event, data }));
assert.equal(sqliteServer.status().oauth_storage_backend, "sqlite");
assert.equal(sqliteServer.status().oauth_storage_file, sqliteStorageFile);
assert.equal(fs.existsSync(sqliteStorageFile), true);
assert.ok(sqliteAudit.some((x) => x.event === "oauth21_clients_loaded" && x.data.backend === "sqlite"));
assert.ok(sqliteAudit.some((x) => x.event === "oauth21_state_loaded" && x.data.backend === "sqlite"));
assert.ok(sqliteAudit.some((x) => x.event === "oauth21_legacy_state_bootstrapped"));
assert.ok(sqliteAudit.some((x) => x.event === "oauth21_legacy_state_retired"));
assert.equal(sqliteServer.validateAccessToken(issued.access_token, { audience: resource }).ok, true);
const sqliteRotated = sqliteServer.token({
  grant_type: "refresh_token",
  client_id: clientId,
  refresh_token: rotatedAfterConcurrentSave.body.refresh_token,
  resource,
});
assert.equal(sqliteRotated.status, 200);
assert.equal(readSqliteCount(sqliteStorageFile, "oauth21_clients") >= 2, true);
assert.equal(readSqliteCount(sqliteStorageFile, "oauth21_refresh_tokens") >= 1, true);
assert.equal(fs.existsSync(clientsFile), false);
assert.equal(fs.existsSync(stateFile), false);
assert.equal(listMigratedFiles(clientsFile).length, 1);
assert.equal(listMigratedFiles(stateFile).length, 1);
const sqliteRestartServer = createOAuth21AuthorizationServer({ issuer, resource, operatorSecret, clientsFile, storageFile: sqliteStorageFile, now });
assert.equal(sqliteRestartServer.validateAccessToken(sqliteRotated.body.access_token, { audience: resource }).ok, true);

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
