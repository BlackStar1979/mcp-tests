const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createAuthPolicy } = require("../src/auth/auth_policy");

function mockReq(authHeader) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

(function testNoneAuth() {
  const policy = createAuthPolicy({ mode: "none" });
  const status = policy.status();

  assert.equal(policy.mode, "none");
  assert.equal(status.requires_auth, false);
  assert.equal(policy.authenticate(mockReq()).ok, true);
})();

(function testBearerAuth() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-auth-"));
  const tokenPath = path.join(dir, "token.txt");
  const token = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZxx";
  fs.writeFileSync(tokenPath, token, "utf8");

  const policy = createAuthPolicy({ mode: "bearer", tokenFile: tokenPath });
  const status = policy.status();

  assert.equal(policy.mode, "bearer");
  assert.equal(status.requires_auth, true);
  assert.equal(status.token_loaded, true);
  assert.equal(status.token_length, token.length);
  assert.match(status.token_sha256_prefix, /^[a-f0-9]{12}$/);

  const missing = policy.authenticate(mockReq());
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 401);
  assert.equal(missing.error, "missing_bearer_token");

  const invalid = policy.authenticate(mockReq("Bearer wrong-token"));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 401);
  assert.equal(invalid.error, "invalid_bearer_token");

  const valid = policy.authenticate(mockReq(`Bearer ${token}`));
  assert.equal(valid.ok, true);
  assert.equal(valid.status, 200);

  fs.rmSync(dir, { recursive: true, force: true });
})();

console.log("smoke_stage2_auth ok");
