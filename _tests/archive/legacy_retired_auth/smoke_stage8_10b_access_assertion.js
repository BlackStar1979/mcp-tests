const assert = require("node:assert/strict");
const {
  ACCESS_ASSERTION_HEADER,
  createAccessAuth,
  extractAccessAssertion,
  hasCloudflareAccessAssertion,
} = require("../src/auth/auth_access");

(function extractorParity() {
  assert.equal(ACCESS_ASSERTION_HEADER, "cf-access-jwt-assertion");
  assert.equal(extractAccessAssertion({ headers: { "cf-access-jwt-assertion": " assertion-value " } }), "assertion-value");
  assert.equal(extractAccessAssertion({ headers: { "Cf-Access-Jwt-Assertion": "assertion-value" } }), "assertion-value");
  assert.equal(extractAccessAssertion({ headers: { "cf-access-jwt-assertion": ["assertion-value"] } }), "assertion-value");
  assert.equal(extractAccessAssertion({ headers: {} }), "");
  assert.equal(hasCloudflareAccessAssertion({ headers: { "cf-access-jwt-assertion": "assertion-value" } }), true);
  assert.equal(hasCloudflareAccessAssertion({ headers: { "cf-access-jwt-assertion": "   " } }), false);
})();

(function policyParity() {
  const policy = createAccessAuth();
  const status = policy.status();

  assert.equal(status.mode, "access");
  assert.equal(status.requires_auth, true);
  assert.equal(status.assertion_header, "cf-access-jwt-assertion");
  assert.equal(status.validates_cloudflare_jwt, false);
  assert.equal(status.expects_cloudflare_proxy, true);
  assert.equal(status.accepts_cf_access_service_token_headers_directly, false);

  const missing = policy.authenticate({ headers: {} });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 401);
  assert.equal(missing.error, "missing_access_assertion");

  const present = policy.authenticate({ headers: { "cf-access-jwt-assertion": "assertion-value" } });
  assert.equal(present.ok, true);
  assert.equal(present.status, 200);
  assert.equal(present.error, "");
})();

console.log("smoke_stage8_10b_access_assertion ok");
