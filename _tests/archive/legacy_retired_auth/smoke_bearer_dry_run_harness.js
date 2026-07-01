const assert = require("node:assert/strict");
const { AUTH_BEARER_DRY_RUN_VERSION, runBearerDryRun } = require("../src/auth_bearer_dry_run");

(function bearerDryRun() {
  const before = String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase();
  const result = runBearerDryRun();

  assert.equal(result.success, true);
  assert.equal(result.mode, "auth-bearer-dry-run");
  assert.equal(result.version, AUTH_BEARER_DRY_RUN_VERSION);
  assert.equal(result.active_auth_mode_before, before);
  assert.equal(result.active_auth_mode_after, before);
  assert.equal(result.bearer_policy_created, true);
  assert.equal(result.bearer_status_safe, true);
  assert.equal(result.accepts_query_token, false);
  assert.equal(result.accepts_query_token_disabled_by_default, true);
  assert.equal(result.challenge_present, true);
  assert.equal(result.missing_rejected_401, true);
  assert.equal(result.invalid_rejected_401, true);
  assert.equal(result.valid_accepted_200, true);
  assert.equal(result.active_auth_mode_unchanged, true);
  assert.equal(result.temp_token_removed, true);
  assert.equal(result.temp_dir_removed, true);
  assert.equal(result.token_path_disclosed, false);
  assert.equal(result.token_disclosed, false);
  assert.match(result.token_sha256_prefix, /^[a-f0-9]{12}$/);
  assert.equal(result.token_length >= 32, true);
  assert.deepEqual(result.response_headers_checked, ["www-authenticate"]);

  assert.deepEqual(result.missing_result, {
    auth_mode: "bearer",
    auth_ok: false,
    auth_error: "missing_bearer_token",
    auth_status: 401,
  });
  assert.deepEqual(result.invalid_result, {
    auth_mode: "bearer",
    auth_ok: false,
    auth_error: "invalid_bearer_token",
    auth_status: 401,
  });
  assert.deepEqual(result.valid_result, {
    auth_mode: "bearer",
    auth_ok: true,
    auth_error: "",
    auth_status: 200,
  });

  assert.deepEqual(result.failures, []);
  assert.equal(result.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(result.explicit_non_scope.writes_repo_secret, false);
  assert.equal(result.explicit_non_scope.writes_persistent_token_file, false);
  assert.equal(result.explicit_non_scope.changes_connector_url, false);
  assert.equal(result.explicit_non_scope.enables_oauth, false);
  assert.equal(result.explicit_non_scope.removes_auth_none, false);
})();

console.log("smoke_stage8_8_bearer_dry_run_harness ok");
