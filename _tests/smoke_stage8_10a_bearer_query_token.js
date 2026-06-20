const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createBearerAuth,
  extractBearerToken,
  extractHeaderBearerToken,
  extractQueryToken,
} = require("../src/auth/auth_bearer");

const TOKEN = "test-mcp-query-token-parity-0123456789abcdef";
const WRONG = "test-mcp-query-token-wrong-0123456789abcdef";

function makeTempTokenFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-query-token-"));
  const file = path.join(dir, "token.txt");
  fs.writeFileSync(file, TOKEN, "utf8");
  return { dir, file };
}

function cleanup(temp) {
  try { fs.unlinkSync(temp.file); } catch (_) {}
  try { fs.rmdirSync(temp.dir); } catch (_) {}
}

(function extractors() {
  assert.equal(extractHeaderBearerToken({ headers: { authorization: `Bearer ${TOKEN}` } }), TOKEN);
  assert.equal(extractHeaderBearerToken({ headers: { Authorization: `Bearer ${TOKEN}` } }), TOKEN);
  assert.equal(extractQueryToken({ query: { token: TOKEN } }), TOKEN);
  assert.equal(extractQueryToken({ query: { token: [TOKEN] } }), TOKEN);
  assert.equal(extractQueryToken({ url: `/mcp?token=${encodeURIComponent(TOKEN)}` }), TOKEN);
  assert.equal(extractQueryToken({ originalUrl: `/mcp?x=1&token=${encodeURIComponent(TOKEN)}` }), TOKEN);
  assert.equal(extractBearerToken({ headers: { authorization: `Bearer ${TOKEN}` }, url: `/mcp?token=${WRONG}` }), TOKEN);
  assert.equal(extractBearerToken({ headers: {}, url: `/mcp?token=${encodeURIComponent(TOKEN)}` }), "");
})();

(function policyAcceptsHeaderAndRejectsQueryByDefault() {
  const temp = makeTempTokenFile();
  try {
    const policy = createBearerAuth({ tokenFile: temp.file });

    assert.equal(policy.status().accepts_authorization_bearer, true);
    assert.equal(policy.status().accepts_query_token, false);

    const missing = policy.authenticate({ headers: {}, url: "/mcp" });
    assert.equal(missing.ok, false);
    assert.equal(missing.status, 401);
    assert.equal(missing.error, "missing_bearer_token");

    const wrong = policy.authenticate({ headers: {}, url: `/mcp?token=${encodeURIComponent(WRONG)}` });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.status, 401);
    assert.equal(wrong.error, "missing_bearer_token");

    const header = policy.authenticate({ headers: { authorization: `Bearer ${TOKEN}` }, url: "/mcp" });
    assert.equal(header.ok, true);
    assert.equal(header.status, 200);

    const query = policy.authenticate({ headers: {}, url: `/mcp?token=${encodeURIComponent(TOKEN)}` });
    assert.equal(query.ok, false);
    assert.equal(query.status, 401);
    assert.equal(query.error, "missing_bearer_token");
  } finally {
    cleanup(temp);
  }
})();

console.log("smoke_stage8_10a_bearer_query_token_disabled_by_default ok");
