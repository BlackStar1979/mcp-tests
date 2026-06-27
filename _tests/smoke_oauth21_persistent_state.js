const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createOAuth21AuthorizationServer, sha256Base64Url } = require("../src/auth/oauth21_authorization_server");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oauth-state-"));
const clientsFile = path.join(tmp, "clients.json");
const stateFile = path.join(tmp, "state.json");
process.env.MCP_TEST_OAUTH_STATE_FILE = stateFile;

const issuer = "http://127.0.0.1:3008";
const operatorSecret = "operator-secret";
const redirectUri = "https://chat.openai.com/aip/callback";
const verifier = "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";

const events1 = [];
const server1 = createOAuth21AuthorizationServer({ issuer, operatorSecret, clientsFile });
server1.setAuditLog((event, data) => events1.push({ event, data }));
assert.ok(events1.some((x) => x.event === "oauth21_state_missing"));
const registration = server1.registerClient({ redirect_uris: [redirectUri], token_endpoint_auth_method: "none" });
assert.equal(registration.status, 201);
const clientId = registration.body.client_id;
const auth = server1.authorize({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  code_challenge_method: "S256",
  code_challenge: sha256Base64Url(verifier),
  state: "abc",
});
assert.equal(auth.status, 302);
const pid = new URL(auth.location).searchParams.get("pid");
const login = server1.completeLogin({ pid, password: operatorSecret, req: { socket: { remoteAddress: "127.0.0.1" }, headers: {} } });
assert.equal(login.status, 302);
const code = new URL(login.location).searchParams.get("code");
const issued = server1.token({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier });
assert.equal(issued.status, 200);
assert.ok(issued.body.access_token);
assert.ok(issued.body.refresh_token);
assert.ok(fs.existsSync(stateFile));
assert.ok(events1.some((x) => x.event === "oauth21_state_saved"));

const events2 = [];
const server2 = createOAuth21AuthorizationServer({ issuer, operatorSecret, clientsFile });
server2.setAuditLog((event, data) => events2.push({ event, data }));
assert.ok(events2.some((x) => x.event === "oauth21_state_loaded"));
assert.equal(server2.validateAccessToken(issued.body.access_token).ok, true);
assert.ok(events2.some((x) => x.event === "oauth21_access_token_accepted"));
const refreshed = server2.token({ grant_type: "refresh_token", client_id: clientId, refresh_token: issued.body.refresh_token });
assert.equal(refreshed.status, 200);
assert.ok(events2.some((x) => x.event === "oauth21_refresh_token_accepted"));
assert.ok(refreshed.body.access_token);
assert.notEqual(refreshed.body.refresh_token, issued.body.refresh_token);
console.log("smoke_oauth21_persistent_state ok");
