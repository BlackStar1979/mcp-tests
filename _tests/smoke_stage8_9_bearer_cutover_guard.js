const assert = require("node:assert/strict");
const { AUTH_BEARER_CUTOVER_GUARD_VERSION, getBearerCutoverGuard } = require("../src/auth_bearer_cutover_guard");

(function bearerCutoverGuardDefaultEnv() {
  const guard = getBearerCutoverGuard();

  assert.equal(guard.success, true);
  assert.equal(guard.mode, "auth-bearer-cutover-guard");
  assert.equal(guard.version, AUTH_BEARER_CUTOVER_GUARD_VERSION);
  assert.equal(guard.current_auth_mode, String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase());
  assert.equal(guard.bearer_dry_run_success, true);
  assert.equal(guard.bearer_ready_for_dry_run, true);
  assert.equal(guard.token_file_configured, false);
  assert.equal(guard.token_file_exists, false);
  assert.equal(guard.cutover_allowed_now, false);
  assert.equal(guard.cutover_recommended_now, false);
  assert.equal(guard.token_path_disclosed, false);
  assert.equal(guard.token_disclosed, false);
  assert.equal(guard.connector_bearer_credential_verified, false);
  assert.equal(guard.connector_bearer_credential_verification_scope, "external-client-ui-step");
  assert.equal(guard.bearer_query_ready, false);
  assert.equal(guard.bearer_query_disabled_by_default, true);
  assert.equal(guard.recommended_chatgpt_direct_delivery, "authorization_bearer_header");

  assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE is not configured"));
  assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE does not point to an existing file"));
  assert.ok(guard.warnings.includes("active runtime is still auth.none; this guard intentionally does not change it"));
  assert.ok(guard.external_operator_steps.length >= 4);
  assert.ok(guard.cutover_plan.length >= 8);
  assert.ok(guard.rollback_plan.length >= 4);

  assert.equal(guard.dry_run_summary.missing_rejected_401, true);
  assert.equal(guard.dry_run_summary.invalid_rejected_401, true);
  assert.equal(guard.dry_run_summary.valid_accepted_200, true);
  assert.equal(guard.dry_run_summary.valid_query_rejected_401, true);
  assert.equal(guard.dry_run_summary.accepts_query_token_disabled_by_default, true);
  assert.equal(guard.dry_run_summary.challenge_present, true);
  assert.equal(guard.dry_run_summary.active_auth_mode_unchanged, true);
  assert.equal(guard.dry_run_summary.temp_token_removed, true);
  assert.equal(guard.dry_run_summary.temp_dir_removed, true);
  assert.equal(guard.dry_run_summary.token_disclosed, false);
  assert.equal(guard.dry_run_summary.token_path_disclosed, false);

  assert.equal(guard.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(guard.explicit_non_scope.writes_secret, false);
  assert.equal(guard.explicit_non_scope.writes_token_file, false);
  assert.equal(guard.explicit_non_scope.discloses_token_path, false);
  assert.equal(guard.explicit_non_scope.changes_connector_url, false);
  assert.equal(guard.explicit_non_scope.configures_connector_credential, false);
  assert.equal(guard.explicit_non_scope.enables_oauth, false);
  assert.equal(guard.explicit_non_scope.removes_auth_none, false);
})();

console.log("smoke_stage8_9_bearer_cutover_guard ok");
