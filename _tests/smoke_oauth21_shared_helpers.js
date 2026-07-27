"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  choosePreferredRefreshToken,
  parseOAuthStateBody,
} = require("../src/auth/oauth21_state_helpers");
const oauthUtils = require("../src/auth/oauth21_utils");
const runtimeResponses = require("../src/runtime/http_responses");

const nowMs = 1000;
const validAccess = { token: "access-valid", expiresAt: 2000 };
const validRefresh = { token: "refresh-valid", expiresAt: 3000, grantId: "grant-a" };
const validUsed = { token: "used-valid", expiresAt: 4000, grantId: "grant-a" };
const parsed = parseOAuthStateBody({
  access: [validAccess, { token: "access-expired", expiresAt: 999 }, null],
  refresh: [validRefresh, { token: "refresh-expired", expiresAt: 1000 }, {}],
  used_refresh: [
    validUsed,
    { token: "used-no-grant", expiresAt: 4000 },
    { token: "used-expired", expiresAt: 999, grantId: "grant-b" },
  ],
}, nowMs);

assert.deepEqual([...parsed.access.entries()], [["access-valid", validAccess]]);
assert.deepEqual([...parsed.refresh.entries()], [["refresh-valid", validRefresh]]);
assert.deepEqual([...parsed.usedRefresh.entries()], [["used-valid", validUsed]]);
assert.equal(parsed.expiredAccess, 2);
assert.equal(parsed.expiredRefresh, 2);
assert.equal(parsed.expiredUsedRefresh, 2);

const early = { token: "early", expiresAt: 2000 };
const late = { token: "late", expiresAt: 3000 };
const tieA = { token: "a", expiresAt: 3000 };
const tieB = { token: "b", expiresAt: 3000 };
assert.equal(choosePreferredRefreshToken(null, late), late);
assert.equal(choosePreferredRefreshToken(early, null), early);
assert.equal(choosePreferredRefreshToken(early, late), late);
assert.equal(choosePreferredRefreshToken(late, early), late);
assert.equal(choosePreferredRefreshToken(tieA, tieB), tieB);
assert.equal(choosePreferredRefreshToken(tieB, tieA), tieB);

assert.strictEqual(oauthUtils.jsonResponse, runtimeResponses.jsonResponse);
const responseCalls = [];
const response = {
  writeHead(statusCode, headers) {
    responseCalls.push({ op: "writeHead", statusCode, headers });
  },
  end(body) {
    responseCalls.push({ op: "end", body });
  },
};
oauthUtils.jsonResponse(response, 201, { ok: true }, { "x-test": "shared" });
assert.deepEqual(responseCalls, [
  {
    op: "writeHead",
    statusCode: 201,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength('{"ok":true}'),
      "cache-control": "no-store",
      "x-test": "shared",
    },
  },
  { op: "end", body: '{"ok":true}' },
]);

const repoRoot = path.join(__dirname, "..");
const authorizationSource = fs.readFileSync(path.join(repoRoot, "src", "auth", "oauth21_authorization_server.js"), "utf8");
const persistenceSource = fs.readFileSync(path.join(repoRoot, "src", "auth", "oauth21_persistence_store.js"), "utf8");
const oauthUtilsSource = fs.readFileSync(path.join(repoRoot, "src", "auth", "oauth21_utils.js"), "utf8");
assert.doesNotMatch(authorizationSource, /function parseOAuthStateBody\s*\(/);
assert.doesNotMatch(authorizationSource, /function choosePreferredRefreshToken\s*\(/);
assert.doesNotMatch(persistenceSource, /function parseOAuthStateBody\s*\(/);
assert.doesNotMatch(persistenceSource, /function choosePreferredRefreshToken\s*\(/);
assert.doesNotMatch(oauthUtilsSource, /function jsonResponse\s*\(/);

console.log("smoke_oauth21_shared_helpers ok");
