const assert = require("node:assert/strict");
const { getAuthTransitionStatus } = require("../src/auth_transition");
const { runBearerDryRun } = require("../src/auth_bearer_dry_run");
const { getBearerCutoverGuard } = require("../src/auth_bearer_cutover_guard");

(function transitionIncludesModularParity() {
  const status = getAuthTransitionStatus({ authMode: "none" });
  assert.equal(status.success, true);
  assert.equal(status.access_implementation_present, true);
  assert.equal(status.access_cloudflare_ready, true);
  assert.equal(status.bearer_header_ready, true);
  assert.equal(status.bearer_query_ready, true);
  assert.equal(status.bearer_ready_for_dry_run, true);
  assert.equal(status.bearer_ready_for_active_switch, false);
  assert.equal(status.public_auth_none_exit_distance, "very-near-but-requires-controlled-rollout");
  assert.deepEqual(status.credential_delivery_variants, [
    "cloudflare_access_assertion_header",
    "authorization_bearer_header",
    "query_token_parameter",
  ]);
  assert.equal(status.explicit_non_scope.configures_connector_credential, false);
  assert.equal(status.explicit_non_scope.validates_cloudflare_jwt, false);
  assert.equal(status.explicit_non_scope.handles_cf_access_client_secret, false);
})();

(function dryRunIncludesQueryToken() {
  const dry = runBearerDryRun();
  assert.equal(dry.success, true);
  assert.equal(dry.accepts_authorization_bearer, true);
  assert.equal(dry.accepts_query_token, true);
  assert.equal(dry.missing_rejected_401, true);
  assert.equal(dry.invalid_rejected_401, true);
  assert.equal(dry.valid_accepted_200, true);
  assert.equal(dry.invalid_query_rejected_401, true);
  assert.equal(dry.valid_query_accepted_200, true);
  assert.equal(dry.temp_token_removed, true);
  assert.equal(dry.temp_dir_removed, true);
  assert.equal(dry.token_disclosed, false);
  assert.equal(dry.token_path_disclosed, false);
})();

(function guardIncludesModularParity() {
  const guard = getBearerCutoverGuard();
  assert.equal(guard.success, true);
  assert.equal(guard.cutover_allowed_now, false);
  assert.equal(guard.access_cloudflare_ready, true);
  assert.equal(guard.bearer_header_ready, true);
  assert.equal(guard.bearer_query_ready, true);
  assert.equal(guard.bearer_dry_run_success, true);
  assert.equal(guard.dry_run_summary.valid_query_accepted_200, true);
  assert.equal(guard.dry_run_summary.invalid_query_rejected_401, true);
  assert.equal(guard.recommended_chatgpt_direct_delivery, "query_token_parameter");
  assert.equal(guard.recommended_header_capable_client_delivery, "authorization_bearer_header");
  assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE is not configured"));
  assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE does not point to an existing file"));
  assert.ok(guard.warnings.some((item) => item.includes("query-token delivery is supported")));
  assert.equal(guard.explicit_non_scope.configures_connector_credential, false);
  assert.equal(guard.explicit_non_scope.validates_cloudflare_jwt, false);
  assert.equal(guard.explicit_non_scope.handles_cf_access_client_secret, false);
})();

console.log("smoke_stage8_10d_readiness_guard_parity ok");
