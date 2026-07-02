const assert = require("node:assert/strict");
const { AUTH_TRANSITION_VERSION, getAuthTransitionStatus } = require("../src/auth_transition");

(function defaultNoneModeReadiness() {
  const status = getAuthTransitionStatus({ authMode: "none" });
  assert.equal(status.success, true);
  assert.equal(status.mode, "auth-transition-status");
  assert.equal(status.version, AUTH_TRANSITION_VERSION);
  assert.equal(status.current_auth_mode, "none");
  assert.equal(status.auth_none_present, true);
  assert.equal(status.bearer_implementation_present, true);
  assert.equal(status.auth_policy_present, true);
  assert.equal(status.bearer_ready_for_dry_run, true);
  assert.equal(status.bearer_ready_for_active_switch, false);
  assert.equal(status.token_file_configured, false);
  assert.equal(status.token_file_exists, false);
  assert.equal(status.token_file_path_disclosed, false);
  assert.equal(status.public_auth_none_exit_distance, "very-near-but-requires-controlled-rollout");
  assert.equal(status.access_cloudflare_ready, true);
  assert.equal(status.bearer_header_ready, true);
  assert.equal(status.bearer_query_ready, true);
  assert.ok(status.warnings.includes("active runtime still uses auth.none"));
  assert.ok(status.no_auth_exit_workflow.length >= 5);
  assert.equal(status.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(status.explicit_non_scope.writes_secret, false);
  assert.equal(status.explicit_non_scope.writes_token_file, false);
  assert.equal(status.explicit_non_scope.changes_connector_url, false);
  assert.equal(status.explicit_non_scope.enables_oauth, false);
  assert.equal(status.explicit_non_scope.removes_auth_none, false);
})();

(function bearerWithoutTokenFileIsBlocked() {
  const status = getAuthTransitionStatus({ authMode: "bearer", tokenFile: "" });
  assert.equal(status.success, false);
  assert.equal(status.current_auth_mode, "bearer");
  assert.equal(status.bearer_ready_for_dry_run, true);
  assert.equal(status.bearer_ready_for_active_switch, false);
  assert.ok(status.blockers.some((item) => item.includes("MCP_TEST_TOKEN_FILE is required")));
})();

(function invalidModeIsBlocked() {
  const status = getAuthTransitionStatus({ authMode: "oauth" });
  assert.equal(status.success, false);
  assert.ok(status.blockers.some((item) => item.includes("unsupported auth mode")));
})();

console.log("smoke_auth_transition_readiness ok");
