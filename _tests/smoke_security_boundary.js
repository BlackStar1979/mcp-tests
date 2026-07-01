const assert = require("node:assert/strict");
const { createAuthPolicy } = require("../src/auth/auth_policy");
const { assertSecurityBoundary, buildSecurityBoundary } = require("../src/security_boundary");

(function testPublicNoneAllowed() {
  const authPolicy = createAuthPolicy({ mode: "none" });
  const boundary = assertSecurityBoundary({ profile: "public", authPolicy, stageStatus: "test" });
  assert.equal(boundary.status, "ok");
  assert.equal(boundary.public_exposure, true);
  assert.equal(boundary.requires_auth, false);
  assert.equal(boundary.plugin_execution_allowed, false);
  assert.equal(boundary.dynamic_import_allowed, false);
  assert.ok(boundary.warnings.some((item) => item.includes("auth.none")));
})();

(function testInternalNoneRejected() {
  const authPolicy = createAuthPolicy({ mode: "none" });
  const boundary = buildSecurityBoundary({ profile: "internal", authPolicy, stageStatus: "test" });
  assert.equal(boundary.status, "error");
  assert.ok(boundary.errors.some((item) => item.includes("authenticated transport")));
  assert.throws(() => assertSecurityBoundary({ profile: "internal", authPolicy, stageStatus: "test" }), /security boundary failed/);
})();

console.log("smoke_security_boundary ok");
