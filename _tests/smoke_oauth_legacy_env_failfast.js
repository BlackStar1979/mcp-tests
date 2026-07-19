// Regression: setting exactly ONE of MCP_TEST_OAUTH_STATE_FILE / _CLIENTS_FILE used to
// silently select the legacy JSON backend and default the MISSING file to a real path
// under ~/.romion — so a test meant to be hermetic would read and write the operator's
// live store. That is the F1 failure. Half-configured must fail fast, not guess.
//
// Note the ordering: the operator-secret check runs BEFORE this one, so the secret must
// be supplied or that error masks the case under test.
const assert = require("assert");
const path = require("path");
const { runServerBootstrapRuntime } = require("../src/runtime/server_bootstrap_runtime.js");

const ROOT = path.join(__dirname, "..");

function attempt(extra) {
  const env = {
    MCP_TEST_AUTH_MODE: "oauth21",
    MCP_TEST_OAUTH_OPERATOR_SECRET: "test-secret-not-a-real-credential",
    ...extra,
  };
  try {
    runServerBootstrapRuntime({ env, rootDir: ROOT });
    return null;
  } catch (e) {
    return String(e.message || e);
  }
}

let checked = 0;
for (const only of ["MCP_TEST_OAUTH_STATE_FILE", "MCP_TEST_OAUTH_CLIENTS_FILE"]) {
  const msg = attempt({ [only]: "/tmp/hermetic-only.json" });
  assert.ok(msg, `half-configured via ${only} must throw, got no error`);
  assert.ok(msg.includes("oauth21_legacy_backend_half_configured"),
    `half-configured via ${only} must fail fast; actual: ${msg}`);
  assert.ok(msg.includes(only),
    `the error must name WHICH var was set, or the operator cannot act on it; actual: ${msg}`);
  checked += 1;
}
assert.strictEqual(checked, 2);

// NOTE — deliberately NOT asserting the fully-configured cases here. runServerBootstrapRuntime
// proceeds to START A SERVER once config validates, so exercising those paths binds a real
// port (observed: EADDRINUSE on 127.0.0.1:3008) and would leave a listener behind on a clean
// machine. A guard test must not need a port. The half-configured cases above throw BEFORE
// any listener is created, which is exactly why they are the hermetic ones. Positive-path
// startup is already covered by the suites that own server lifecycle.

console.log("smoke_oauth_legacy_env_failfast: PASS");
